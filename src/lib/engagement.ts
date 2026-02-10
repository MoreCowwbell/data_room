import type { SupabaseClient } from '@supabase/supabase-js'

export type EngagementFilters = {
    search?: string
    domain?: string
    linkId?: string
    documentId?: string
    from?: string
    to?: string
}

export type EngagementRow = {
    linkId: string
    linkName: string
    linkSlug: string
    email: string
    domain: string
    firstViewAt: string
    lastViewAt: string
    sessions: number
    totalTimeSeconds: number
    docsViewed: number
    pagesViewed: number
    downloads: number
    ndaAccepted: boolean
}

function toDateMillis(input: string | undefined): number | null {
    if (!input) return null
    const millis = Date.parse(input)
    return Number.isNaN(millis) ? null : millis
}

function matchesSearch(haystack: string, query: string): boolean {
    return haystack.toLowerCase().includes(query.toLowerCase())
}

export async function getRoomEngagementRows(
    supabase: SupabaseClient,
    roomId: string,
    filters: EngagementFilters
): Promise<EngagementRow[]> {
    const { data: links } = await supabase
        .from('shared_links')
        .select('id, slug, name')
        .eq('room_id', roomId)

    if (!links || links.length === 0) {
        return []
    }

    const linkIds = links.map((link) => link.id)
    const linkById = new Map(links.map((link) => [link.id, link]))

    let logsQuery = supabase
        .from('link_access_logs')
        .select('id, link_id, visitor_email, visitor_session_token, started_at, last_active_at')
        .in('link_id', linkIds)

    if (filters.from) {
        logsQuery = logsQuery.gte('started_at', filters.from)
    }
    if (filters.to) {
        logsQuery = logsQuery.lte('started_at', filters.to)
    }
    if (filters.linkId) {
        logsQuery = logsQuery.eq('link_id', filters.linkId)
    }

    const { data: logs } = await logsQuery
    if (!logs || logs.length === 0) {
        return []
    }

    const tokenToViewer = new Map<string, { linkId: string; email: string }>()
    for (const log of logs) {
        if (!log.visitor_session_token || !log.visitor_email) continue
        tokenToViewer.set(log.visitor_session_token, { linkId: log.link_id, email: log.visitor_email })
    }

    let pageViewsQuery = supabase
        .from('page_views')
        .select('link_id, document_id, visitor_session_token, page_number, duration_seconds, viewed_at')
        .in('link_id', linkIds)

    if (filters.from) {
        pageViewsQuery = pageViewsQuery.gte('viewed_at', filters.from)
    }
    if (filters.to) {
        pageViewsQuery = pageViewsQuery.lte('viewed_at', filters.to)
    }
    if (filters.linkId) {
        pageViewsQuery = pageViewsQuery.eq('link_id', filters.linkId)
    }
    if (filters.documentId) {
        pageViewsQuery = pageViewsQuery.eq('document_id', filters.documentId)
    }

    const [{ data: pageViews }, { data: downloadEvents }, { data: ndaAcceptances }, { data: documents }] = await Promise.all([
        pageViewsQuery,
        supabase
            .from('download_events')
            .select('link_id, viewer_email, downloaded_at')
            .in('link_id', linkIds),
        supabase
            .from('nda_acceptances')
            .select('link_id, viewer_email, accepted_at')
            .in('link_id', linkIds),
        supabase
            .from('documents')
            .select('id, filename')
            .eq('room_id', roomId),
    ])

    const documentNameById = new Map((documents ?? []).map((document) => [document.id, document.filename]))

    type MutableAggregate = {
        linkId: string
        email: string
        firstViewAt: string
        lastViewAt: string
        sessionTokens: Set<string>
        docsViewed: Set<string>
        pagesViewed: number
        totalTimeSeconds: number
        downloads: number
        ndaAccepted: boolean
    }

    const aggregates = new Map<string, MutableAggregate>()
    const keyFor = (linkId: string, email: string) => `${linkId}::${email.toLowerCase()}`
    const dateFromMillis = toDateMillis(filters.from)
    const dateToMillis = toDateMillis(filters.to)

    for (const log of logs) {
        const email = (log.visitor_email || '').trim().toLowerCase()
        if (!email) continue

        const startedAt = log.started_at || new Date().toISOString()
        const lastActiveAt = log.last_active_at || startedAt
        const startedMs = Date.parse(startedAt)
        if (!Number.isNaN(startedMs)) {
            if (dateFromMillis !== null && startedMs < dateFromMillis) continue
            if (dateToMillis !== null && startedMs > dateToMillis) continue
        }

        const aggregateKey = keyFor(log.link_id, email)
        const existing = aggregates.get(aggregateKey)
        if (!existing) {
            aggregates.set(aggregateKey, {
                linkId: log.link_id,
                email,
                firstViewAt: startedAt,
                lastViewAt: lastActiveAt,
                sessionTokens: new Set(log.visitor_session_token ? [log.visitor_session_token] : []),
                docsViewed: new Set(),
                pagesViewed: 0,
                totalTimeSeconds: 0,
                downloads: 0,
                ndaAccepted: false,
            })
        } else {
            existing.firstViewAt = existing.firstViewAt < startedAt ? existing.firstViewAt : startedAt
            existing.lastViewAt = existing.lastViewAt > lastActiveAt ? existing.lastViewAt : lastActiveAt
            if (log.visitor_session_token) {
                existing.sessionTokens.add(log.visitor_session_token)
            }
        }
    }

    for (const pageView of pageViews ?? []) {
        if (!pageView.visitor_session_token) continue
        const tokenViewer = tokenToViewer.get(pageView.visitor_session_token)
        if (!tokenViewer) continue

        const aggregateKey = keyFor(tokenViewer.linkId, tokenViewer.email)
        const aggregate = aggregates.get(aggregateKey)
        if (!aggregate) continue

        if (filters.documentId && pageView.document_id !== filters.documentId) {
            continue
        }
        if (filters.search) {
            const docName = documentNameById.get(pageView.document_id) || ''
            if (!matchesSearch(docName, filters.search) && !matchesSearch(aggregate.email, filters.search)) {
                continue
            }
        }

        aggregate.pagesViewed += 1
        aggregate.totalTimeSeconds += Number(pageView.duration_seconds) || 0
        if (pageView.document_id) {
            aggregate.docsViewed.add(pageView.document_id)
        }
    }

    for (const event of downloadEvents ?? []) {
        const email = (event.viewer_email || '').trim().toLowerCase()
        if (!email) continue
        const aggregate = aggregates.get(keyFor(event.link_id, email))
        if (!aggregate) continue
        aggregate.downloads += 1
    }

    for (const acceptance of ndaAcceptances ?? []) {
        const email = (acceptance.viewer_email || '').trim().toLowerCase()
        if (!email) continue
        const aggregate = aggregates.get(keyFor(acceptance.link_id, email))
        if (!aggregate) continue
        aggregate.ndaAccepted = true
    }

    const rows: EngagementRow[] = []
    for (const aggregate of aggregates.values()) {
        const link = linkById.get(aggregate.linkId)
        if (!link) continue

        const domain = aggregate.email.includes('@') ? aggregate.email.split('@')[1] : ''
        if (filters.domain && domain.toLowerCase() !== filters.domain.toLowerCase()) continue
        if (filters.search) {
            const haystack = `${aggregate.email} ${domain} ${link.slug} ${link.name || ''}`
            if (!matchesSearch(haystack, filters.search)) continue
        }

        rows.push({
            linkId: aggregate.linkId,
            linkName: link.name || '(unnamed link)',
            linkSlug: link.slug,
            email: aggregate.email,
            domain,
            firstViewAt: aggregate.firstViewAt,
            lastViewAt: aggregate.lastViewAt,
            sessions: aggregate.sessionTokens.size,
            totalTimeSeconds: Number(aggregate.totalTimeSeconds.toFixed(2)),
            docsViewed: aggregate.docsViewed.size,
            pagesViewed: aggregate.pagesViewed,
            downloads: aggregate.downloads,
            ndaAccepted: aggregate.ndaAccepted,
        })
    }

    rows.sort((a, b) => Date.parse(b.lastViewAt) - Date.parse(a.lastViewAt))
    return rows
}

export function toCsv(rows: EngagementRow[]): string {
    const headers = [
        'email',
        'domain',
        'link_name',
        'link_slug',
        'first_view_at',
        'last_view_at',
        'sessions',
        'total_time_seconds',
        'docs_viewed',
        'pages_viewed',
        'downloads',
        'nda_accepted',
    ]

    const escape = (value: string | number | boolean) => {
        const asString = String(value)
        if (asString.includes(',') || asString.includes('"') || asString.includes('\n')) {
            return `"${asString.replace(/"/g, '""')}"`
        }
        return asString
    }

    const dataLines = rows.map((row) =>
        [
            row.email,
            row.domain,
            row.linkName,
            row.linkSlug,
            row.firstViewAt,
            row.lastViewAt,
            row.sessions,
            row.totalTimeSeconds,
            row.docsViewed,
            row.pagesViewed,
            row.downloads,
            row.ndaAccepted ? 'yes' : 'no',
        ]
            .map(escape)
            .join(',')
    )

    return [headers.join(','), ...dataLines].join('\n')
}
