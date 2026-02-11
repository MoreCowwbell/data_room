import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getRoomEngagementRows } from '@/lib/engagement'
import { FUNDRAISING_TEMPLATE } from '@/lib/vault-templates'

/**
 * Creates AI tools scoped to a specific room via closure.
 * The roomId is set from the authenticated request and cannot be overridden by the LLM.
 */
export function createRoomTools(supabase: SupabaseClient, roomId: string) {
    return {
        listRoomStructure: {
            description: 'List all folders and documents in this data room, showing the complete hierarchy.',
            inputSchema: z.object({}),
            execute: async () => {
                const [{ data: folders }, { data: documents }] = await Promise.all([
                    supabase
                        .from('folders')
                        .select('id, name, parent_id, created_at')
                        .eq('room_id', roomId)
                        .is('deleted_at', null)
                        .order('name'),
                    supabase
                        .from('documents')
                        .select('id, filename, folder_id, mime_type, file_size, created_at')
                        .eq('room_id', roomId)
                        .is('deleted_at', null)
                        .order('filename'),
                ])

                return {
                    folders: (folders ?? []).map((f) => ({
                        id: f.id,
                        name: f.name,
                        parentId: f.parent_id,
                        createdAt: f.created_at,
                    })),
                    documents: (documents ?? []).map((d) => ({
                        id: d.id,
                        filename: d.filename,
                        folderId: d.folder_id,
                        mimeType: d.mime_type,
                        fileSize: d.file_size,
                        createdAt: d.created_at,
                    })),
                    totalFolders: (folders ?? []).length,
                    totalDocuments: (documents ?? []).length,
                }
            },
        },

        getDocumentText: {
            description: 'Get the extracted text content of a specific document by its ID. Use listRoomStructure first to find document IDs.',
            inputSchema: z.object({
                documentId: z.string().uuid().describe('The document ID to extract text from'),
            }),
            execute: async ({ documentId }: { documentId: string }) => {
                // Verify document belongs to this room
                const { data: doc } = await supabase
                    .from('documents')
                    .select('id, filename, storage_path')
                    .eq('id', documentId)
                    .eq('room_id', roomId)
                    .is('deleted_at', null)
                    .maybeSingle()

                if (!doc) {
                    return { error: 'Document not found in this room' }
                }

                // Check cache first
                const { data: cached } = await supabase
                    .from('document_text_cache')
                    .select('extracted_text, page_count')
                    .eq('document_id', documentId)
                    .maybeSingle()

                if (cached) {
                    return {
                        filename: doc.filename,
                        text: cached.extracted_text,
                        pageCount: cached.page_count,
                        source: 'cache',
                    }
                }

                // If no cache, download and extract
                const { data: fileData, error: downloadError } = await supabase.storage
                    .from('documents')
                    .download(doc.storage_path)

                if (downloadError || !fileData) {
                    return { error: 'Failed to download document for text extraction' }
                }

                try {
                    // Use a simple text extraction approach
                    // For PDFs, extract raw text content
                    const buffer = await fileData.arrayBuffer()
                    const text = extractTextFromPdfBuffer(new Uint8Array(buffer))

                    // Cache the result
                    await supabase.from('document_text_cache').upsert(
                        {
                            document_id: documentId,
                            room_id: roomId,
                            extracted_text: text,
                            page_count: null,
                            extracted_at: new Date().toISOString(),
                        },
                        { onConflict: 'document_id' }
                    )

                    return {
                        filename: doc.filename,
                        text: text.slice(0, 50000), // Cap at 50K chars for context window
                        pageCount: null,
                        source: 'extracted',
                    }
                } catch {
                    return { error: 'Failed to extract text from document' }
                }
            },
        },

        getEngagementMetrics: {
            description: 'Get visitor engagement metrics for this data room. Shows who viewed documents, time spent, downloads, and NDA status. Supports filtering by email search, domain, link, document, or date range.',
            inputSchema: z.object({
                search: z.string().optional().describe('Search by email or domain'),
                domain: z.string().optional().describe('Filter by email domain (e.g., "sequoia.com")'),
                linkId: z.string().uuid().optional().describe('Filter by specific shared link ID'),
                documentId: z.string().uuid().optional().describe('Filter by specific document ID'),
                from: z.string().optional().describe('Start date (ISO 8601)'),
                to: z.string().optional().describe('End date (ISO 8601)'),
            }),
            execute: async (filters: { search?: string; domain?: string; linkId?: string; documentId?: string; from?: string; to?: string }) => {
                const rows = await getRoomEngagementRows(supabase, roomId, filters)

                const summary = {
                    totalVisitors: rows.length,
                    totalSessions: rows.reduce((sum, r) => sum + r.sessions, 0),
                    totalTimeMinutes: Math.round(rows.reduce((sum, r) => sum + r.totalTimeSeconds, 0) / 60),
                    totalDownloads: rows.reduce((sum, r) => sum + r.downloads, 0),
                    ndaAcceptedCount: rows.filter((r) => r.ndaAccepted).length,
                    uniqueDomains: [...new Set(rows.map((r) => r.domain).filter(Boolean))],
                }

                return {
                    summary,
                    visitors: rows.slice(0, 50).map((r) => ({
                        email: r.email,
                        domain: r.domain,
                        sessions: r.sessions,
                        totalTimeSeconds: r.totalTimeSeconds,
                        docsViewed: r.docsViewed,
                        pagesViewed: r.pagesViewed,
                        downloads: r.downloads,
                        ndaAccepted: r.ndaAccepted,
                        firstViewAt: r.firstViewAt,
                        lastViewAt: r.lastViewAt,
                        linkName: r.linkName,
                    })),
                    truncated: rows.length > 50,
                }
            },
        },

        analyzeCompleteness: {
            description: 'Compare the data room folder structure against the standard fundraising template to identify missing or empty categories. Helps founders understand what documents they still need to prepare.',
            inputSchema: z.object({}),
            execute: async () => {
                const [{ data: folders }, { data: documents }] = await Promise.all([
                    supabase
                        .from('folders')
                        .select('id, name')
                        .eq('room_id', roomId)
                        .is('deleted_at', null),
                    supabase
                        .from('documents')
                        .select('id, folder_id')
                        .eq('room_id', roomId)
                        .is('deleted_at', null),
                ])

                const folderNames = new Set((folders ?? []).map((f) => f.name.toLowerCase()))
                const docsByFolder = new Map<string, number>()
                for (const doc of documents ?? []) {
                    const key = doc.folder_id || 'root'
                    docsByFolder.set(key, (docsByFolder.get(key) || 0) + 1)
                }

                const folderIdByName = new Map(
                    (folders ?? []).map((f) => [f.name.toLowerCase(), f.id])
                )

                const analysis = FUNDRAISING_TEMPLATE.folders.map((templateFolder) => {
                    const matchedName = folderNames.has(templateFolder.name.toLowerCase())
                    const folderId = folderIdByName.get(templateFolder.name.toLowerCase())
                    const docCount = folderId ? (docsByFolder.get(folderId) || 0) : 0

                    let status: 'missing' | 'empty' | 'has_documents'
                    if (!matchedName) {
                        status = 'missing'
                    } else if (docCount === 0) {
                        status = 'empty'
                    } else {
                        status = 'has_documents'
                    }

                    return {
                        category: templateFolder.name,
                        description: templateFolder.description,
                        status,
                        documentCount: docCount,
                    }
                })

                const completionRate = analysis.filter((a) => a.status === 'has_documents').length / analysis.length

                return {
                    templateName: FUNDRAISING_TEMPLATE.label,
                    completionRate: Math.round(completionRate * 100),
                    totalCategories: analysis.length,
                    categoriesWithDocs: analysis.filter((a) => a.status === 'has_documents').length,
                    emptyCategories: analysis.filter((a) => a.status === 'empty').length,
                    missingCategories: analysis.filter((a) => a.status === 'missing').length,
                    details: analysis,
                    totalDocuments: (documents ?? []).length,
                    rootDocuments: docsByFolder.get('root') || 0,
                }
            },
        },
    }
}

/**
 * Simple PDF text extraction by parsing raw PDF stream content.
 * This extracts text from PDF content streams using basic text operators.
 * For production, consider using `unpdf` or `pdf-parse` for better extraction.
 */
function extractTextFromPdfBuffer(buffer: Uint8Array): string {
    const decoder = new TextDecoder('latin1')
    const raw = decoder.decode(buffer)

    const textChunks: string[] = []

    // Extract text between BT...ET blocks (PDF text objects)
    const btEtRegex = /BT\s([\s\S]*?)ET/g
    let match
    while ((match = btEtRegex.exec(raw)) !== null) {
        const block = match[1]
        // Extract text from Tj, TJ, ' and " operators
        const tjRegex = /\(([^)]*)\)\s*Tj/g
        let tjMatch
        while ((tjMatch = tjRegex.exec(block)) !== null) {
            textChunks.push(tjMatch[1])
        }

        // TJ array: [(text) kerning (text) ...]
        const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g
        let tjArrayMatch
        while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
            const inner = tjArrayMatch[1]
            const innerTextRegex = /\(([^)]*)\)/g
            let innerMatch
            while ((innerMatch = innerTextRegex.exec(inner)) !== null) {
                textChunks.push(innerMatch[1])
            }
        }
    }

    if (textChunks.length === 0) {
        return '(No extractable text found in this PDF. It may contain scanned images or use non-standard encoding.)'
    }

    return textChunks.join(' ').replace(/\\n/g, '\n').replace(/\s+/g, ' ').trim()
}
