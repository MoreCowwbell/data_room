import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import SecureDocumentViewer from '@/components/SecureDocumentViewer'
import { cookies } from 'next/headers'

export default async function ViewPage({ params }: { params: Promise<{ slug: string }> }) {
    const supabase = await createClient()
    const { slug } = await params

    // 1. Get Link & Document
    const { data: link } = await supabase
        .from('shared_links')
        .select(`
            *,
            document:documents(*)
        `)
        .eq('slug', slug)
        .single()

    if (!link || !link.is_active || !link.document) {
        return notFound()
    }

    // 2. Validate Session
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(`visitor_session_${link.id}`)?.value

    if (!sessionToken) {
        return redirect(`/v/${slug}`)
    }

    // 3. Get Visitor Email (from access log or we could encode in token, but DB check is safer)
    const { data: log } = await supabase
        .from('link_access_logs')
        .select('visitor_email, ip_address')
        .eq('visitor_session_token', sessionToken)
        .limit(1)
        .single()

    const visitorEmail = log?.visitor_email || 'Visitor'
    const ip = log?.ip_address || '127.0.0.1'
    const watermarkText = `${visitorEmail} - ${ip} - ${new Date().toISOString().split('T')[0]}`

    // 4. Construct Stream URL
    const streamUrl = `/api/stream/${link.document.id}?linkId=${link.id}`

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <header className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-20">
                <h1 className="font-semibold text-lg max-w-xl truncate">{link.document.filename}</h1>
                <div className="text-sm text-gray-500">
                    Viewing as {visitorEmail}
                </div>
            </header>

            <main className="flex-1 flex justify-center py-8">
                <SecureDocumentViewer docUrl={streamUrl} watermarkText={watermarkText} />
            </main>
        </div>
    )
}
