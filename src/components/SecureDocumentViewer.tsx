'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Loader2 } from 'lucide-react'

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

function drawCanvasWatermark(canvas: HTMLCanvasElement, text: string) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.font = '16px sans-serif'
    ctx.fillStyle = '#666'
    ctx.translate(width / 2, height / 2)
    ctx.rotate((-32 * Math.PI) / 180)

    const stepX = 260
    const stepY = 100
    for (let y = -height; y < height; y += stepY) {
        for (let x = -width; x < width; x += stepX) {
            ctx.fillText(text, x, y)
        }
    }
    ctx.restore()
}

function WatermarkCanvas({ width, height, text }: { width: number; height: number; text: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (canvasRef.current) {
            canvasRef.current.width = width
            canvasRef.current.height = height
            drawCanvasWatermark(canvasRef.current, text)
        }
    }, [width, height, text])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-10"
            style={{ width, height }}
        />
    )
}

export default function SecureDocumentViewer({
    docUrl,
    watermarkText
}: {
    docUrl: string,
    watermarkText: string
}) {
    const [numPages, setNumPages] = useState<number | null>(null)
    const [pageWidth, setPageWidth] = useState(Math.min(typeof window !== 'undefined' ? window.innerWidth - 40 : 800, 800))
    const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map())
    const startTimeRef = useRef<number>(0)
    const currentPageRef = useRef<number>(1)

    // Beacon sender
    const sendBeacon = useCallback((page: number, duration: number) => {
        if (duration < 1) return // Ignore very short views

        const parsedUrl = new URL(docUrl, window.location.href)
        const linkId = parsedUrl.searchParams.get('linkId')
        const docId = docUrl.split('/stream/')[1]?.split('?')[0]

        if (!linkId || !docId) return

        const data = JSON.stringify({
            linkId,
            docId,
            page,
            duration
        })
        navigator.sendBeacon('/api/analytics/beacon', data)
    }, [docUrl])

    useEffect(() => {
        startTimeRef.current = Date.now()
    }, [])

    // Responsive page width
    useEffect(() => {
        function handleResize() {
            setPageWidth(Math.min(window.innerWidth - 40, 800))
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Intersection Observer to track visible page
    useEffect(() => {
        if (!numPages) return

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const page = Number(entry.target.getAttribute('data-page'))
                    if (page && page !== currentPageRef.current) {
                        const now = Date.now()
                        const duration = (now - startTimeRef.current) / 1000
                        sendBeacon(currentPageRef.current, duration)

                        startTimeRef.current = now
                        currentPageRef.current = page
                    }
                }
            })
        }, { threshold: 0.5 })

        document.querySelectorAll('.group[data-page]').forEach(el => observer.observe(el))

        return () => {
            const now = Date.now()
            const duration = (now - startTimeRef.current) / 1000
            sendBeacon(currentPageRef.current, duration)
            observer.disconnect()
        }
    }, [numPages, sendBeacon])

    // Handle visibility change (tab switch)
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
    }, [sendBeacon])

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages)
    }

    function onPageLoadSuccess(pageNumber: number, page: { width: number; height: number }) {
        const scale = pageWidth / page.width
        setPageDimensions((prev) => {
            const next = new Map(prev)
            next.set(pageNumber, { width: pageWidth, height: page.height * scale })
            return next
        })
    }

    return (
        <div
            className="relative w-full flex flex-col items-center bg-gray-100 dark:bg-gray-900 p-4 select-none"
            onContextMenu={(e) => e.preventDefault()}
        >
            <Document
                file={docUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<Loader2 className="w-8 h-8 animate-spin text-gray-500" />}
                className="shadow-lg"
            >
                {Array.from(new Array(numPages), (_, index) => {
                    const dims = pageDimensions.get(index + 1)
                    return (
                        <div key={`page_${index + 1}`} className="relative mb-4 group" data-page={index + 1}>
                            <Page
                                pageNumber={index + 1}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                className="bg-white"
                                width={pageWidth}
                                onLoadSuccess={(page) => onPageLoadSuccess(index + 1, page)}
                            />
                            {dims && (
                                <WatermarkCanvas
                                    width={dims.width}
                                    height={dims.height}
                                    text={watermarkText}
                                />
                            )}
                        </div>
                    )
                })}
            </Document>
        </div>
    )
}
