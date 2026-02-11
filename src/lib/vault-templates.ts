export type TemplateFolder = {
    name: string
    description: string
}

export type VaultTemplate = {
    id: string
    label: string
    folders: TemplateFolder[]
    guideFilename: string
}

export const FUNDRAISING_TEMPLATE: VaultTemplate = {
    id: 'fundraising',
    label: 'Fundraising Template',
    guideFilename: 'OpenVault_Fundraising_Guide.pdf',
    folders: [
        {
            name: 'Corporate Documents',
            description:
                'Certificate of incorporation, bylaws, board resolutions, operating agreements, and other governance documents.',
        },
        {
            name: 'Financial Statements',
            description:
                'Audited and unaudited financial statements, balance sheets, income statements, cash flow projections, and tax returns.',
        },
        {
            name: 'Cap Table & Equity',
            description:
                'Capitalization table, stock option plans, SAFE/convertible note agreements, and shareholder registry.',
        },
        {
            name: 'Fundraising Materials',
            description:
                'Pitch deck, executive summary, financial model, and term sheets (current or past rounds).',
        },
        {
            name: 'Intellectual Property',
            description:
                'Patent filings, trademarks, copyrights, trade secrets documentation, and IP assignment agreements.',
        },
        {
            name: 'Legal & Compliance',
            description:
                'Material contracts, customer/vendor agreements, litigation history, regulatory filings, and insurance policies.',
        },
        {
            name: 'Team & HR',
            description:
                'Org chart, key employee bios, employment agreements, advisor agreements, and employee handbook.',
        },
        {
            name: 'Product & Technology',
            description:
                'Product roadmap, architecture overview, technical documentation, and third-party integrations/licenses.',
        },
        {
            name: 'Market & Customers',
            description:
                'Market analysis, competitive landscape, customer list/references, case studies, and sales pipeline data.',
        },
    ],
}

export const VAULT_TEMPLATES: Record<string, VaultTemplate> = {
    fundraising: FUNDRAISING_TEMPLATE,
}
