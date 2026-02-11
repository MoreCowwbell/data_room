import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { VaultTemplate } from './vault-templates'

export async function generateGuidePdf(template: VaultTemplate): Promise<Uint8Array> {
    const pdf = await PDFDocument.create()
    const helvetica = await pdf.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold)

    const pageWidth = 612
    const pageHeight = 792
    const margin = 60
    const contentWidth = pageWidth - margin * 2

    let page = pdf.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    // Title
    page.drawText('OpenVault Fundraising Guide', {
        x: margin,
        y,
        size: 22,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
    })
    y -= 30

    // Subtitle
    page.drawText('Recommended folder structure for your fundraising data room', {
        x: margin,
        y,
        size: 11,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
    })
    y -= 40

    // Intro paragraph
    const introLines = wrapText(
        'This vault has been pre-populated with folders commonly used during startup fundraising. ' +
        'Upload your documents into the appropriate folders, then create sharing links to distribute to investors.',
        helvetica,
        10,
        contentWidth,
    )
    for (const line of introLines) {
        page.drawText(line, {
            x: margin,
            y,
            size: 10,
            font: helvetica,
            color: rgb(0.2, 0.2, 0.2),
        })
        y -= 16
    }
    y -= 12

    // Folder descriptions
    for (const folder of template.folders) {
        // Check if we need a new page
        if (y < margin + 60) {
            page = pdf.addPage([pageWidth, pageHeight])
            y = pageHeight - margin
        }

        // Folder name
        page.drawText(folder.name, {
            x: margin,
            y,
            size: 12,
            font: helveticaBold,
            color: rgb(0.1, 0.1, 0.1),
        })
        y -= 18

        // Description
        const descLines = wrapText(folder.description, helvetica, 10, contentWidth - 12)
        for (const line of descLines) {
            page.drawText(line, {
                x: margin + 12,
                y,
                size: 10,
                font: helvetica,
                color: rgb(0.3, 0.3, 0.3),
            })
            y -= 15
        }
        y -= 10
    }

    return pdf.save()
}

function wrapText(
    text: string,
    font: { widthOfTextAtSize: (text: string, size: number) => number },
    fontSize: number,
    maxWidth: number,
): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''

    for (const word of words) {
        const test = current ? `${current} ${word}` : word
        if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
            lines.push(current)
            current = word
        } else {
            current = test
        }
    }
    if (current) {
        lines.push(current)
    }

    return lines
}
