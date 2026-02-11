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
    guideFilename: 'OpenVault_Dataroom_Guide.pdf',
    folders: [
        {
            name: '00_Overview',
            description:
                'Welcome guide, data room overview, and instructions for navigating this vault.',
        },
        {
            name: '01_Fundraising_Materials',
            description:
                'Pitch deck, executive summary, financial model, and term sheets (current or past rounds).',
        },
        {
            name: '02_Corporate_Documents',
            description:
                'Certificate of incorporation, bylaws, board resolutions, operating agreements, and other governance documents.',
        },
        {
            name: '03_Cap_Table_&_Equity',
            description:
                'Capitalization table, stock option plans, SAFE/convertible note agreements, and shareholder registry.',
        },
        {
            name: '04_Team_&_HR',
            description:
                'Org chart, key employee bios, employment agreements, advisor agreements, and employee handbook.',
        },
        {
            name: '05_Product_&_Technology',
            description:
                'Product roadmap, architecture overview, technical documentation, and third-party integrations/licenses.',
        },
        {
            name: '06_Intellectual_Property',
            description:
                'Patent filings, trademarks, copyrights, trade secrets documentation, and IP assignment agreements.',
        },
        {
            name: '07_Market_&_Customers',
            description:
                'Market analysis, competitive landscape, customer list/references, case studies, and sales pipeline data.',
        },
        {
            name: '08_Financials',
            description:
                'Audited and unaudited financial statements, balance sheets, income statements, cash flow projections, and tax returns.',
        },
        {
            name: '09_Legal_&_Compliance',
            description:
                'Material contracts, customer/vendor agreements, litigation history, regulatory filings, and insurance policies.',
        },
        {
            name: '10_Diligence_QA',
            description:
                'Due diligence questions and answers, management responses, and follow-up documentation.',
        },
    ],
}

export const VAULT_TEMPLATES: Record<string, VaultTemplate> = {
    fundraising: FUNDRAISING_TEMPLATE,
}
