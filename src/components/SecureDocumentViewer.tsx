'use client'

import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Loader2 } from 'lucide-react'

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function SecureDocumentViewer({
    docUrl,
    watermarkText
}: {
    docUrl: string,
    watermarkText: string
}) {
    const [numPages, setNumPages] = useState<number | null>(null)
    const [pageTimes, setPageTimes] = useState<Record<number, number>>({})
    const startTimeRef = useRef<number>(Date.now())
    const currentPageRef = useRef<number>(1)

    // Beacon sender
    const sendBeacon = (page: number, duration: number) => {
        if (duration < 1) return // Ignore very short views
        const data = JSON.stringify({
            // linkId and docId are needed. 
            // We need to pass them as props or extract from URL?
            // The viewer component doesn't have linkId/docId props right now, only docUrl.
            // But docUrl contains linkId in query param!
            // Let's parse it.
            linkId: new URL(docUrl, window.location.href).searchParams.get('linkId'),
            docId: docUrl.split('/stream/')[1]?.split('?')[0],
            page,
            duration
        })
        navigator.sendBeacon('/api/analytics/beacon', data)
    }

    // Intersection Observer to track visible page
    useEffect(() => {
        if (!numPages) return

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const page = Number(entry.target.getAttribute('data-page'))
                    if (page && page !== currentPageRef.current) {
                        // Page changed. Send beacon for previous page.
                        const now = Date.now()
                        const duration = (now - startTimeRef.current) / 1000
                        sendBeacon(currentPageRef.current, duration)

                        // Reset for new page
                        startTimeRef.current = now
                        currentPageRef.current = page
                    }
                }
            })
        }, { threshold: 0.5 })

        document.querySelectorAll('.group[data-page]').forEach(el => observer.observe(el))

        return () => {
            // Send final beacon
            const now = Date.now()
            const duration = (now - startTimeRef.current) / 1000
            sendBeacon(currentPageRef.current, duration)
            observer.disconnect()
        }
    }, [numPages, docUrl])

    // Also handle visibility change (tab switch)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                const now = Date.now()
                const duration = (now - startTimeRef.current) / 1000
                sendBeacon(currentPageRef.current, duration)
            } else {
                startTimeRef.current = Date.now()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [])

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages)
    }

    return (
        <div
            className="relative w-full flex flex-col items-center bg-gray-100 dark:bg-gray-900 p-4 select-none"
            onContextMenu={(e) => e.preventDefault()} // Disable right click
        >
            <Document
                file={docUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<Loader2 className="w-8 h-8 animate-spin text-gray-500" />}
                className="shadow-lg"
            >
                {Array.from(new Array(numPages), (el, index) => (
                    <div key={`page_${index + 1}`} className="relative mb-4 group" data-page={index + 1}>
                        <Page
                            pageNumber={index + 1}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            className="bg-white"
                            width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 40 : 800, 800)} // Responsive width fix
                        />

                        {/* Watermark Overlay */}
                        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center overflow-hidden">
                            <div className="opacity-20 transform -rotate-45 text-gray-500 text-2xl font-bold whitespace-nowrap select-none">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div key={i} className="mb-16">
                                        {watermarkText} &nbsp;&nbsp;&nbsp; {watermarkText}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </Document>
        </div>
    )
}
