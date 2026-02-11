'use client'

import { useState, useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bot, Send, Settings, Trash2, Key, Shield } from 'lucide-react'

type AiProvider = 'anthropic' | 'openai' | 'google'

type StoredKey = {
    provider: AiProvider
    keyHint: string
    updatedAt: string
}

const PROVIDER_LABELS: Record<AiProvider, string> = {
    anthropic: 'Anthropic (Claude)',
    openai: 'OpenAI (GPT)',
    google: 'Google (Gemini)',
}

function getMessageText(message: { parts?: Array<{ type: string; text?: string }>; content?: string }): string {
    if (message.parts) {
        return message.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
            .map((p) => p.text)
            .join('')
    }
    return typeof message.content === 'string' ? message.content : ''
}

export function AiPanel({ roomId }: { roomId: string }) {
    const [open, setOpen] = useState(false)
    const [consented, setConsented] = useState<boolean | null>(null)
    const [provider, setProvider] = useState<AiProvider>('anthropic')
    const [storedKeys, setStoredKeys] = useState<StoredKey[]>([])
    const [newKeyProvider, setNewKeyProvider] = useState<AiProvider>('anthropic')
    const [newKeyValue, setNewKeyValue] = useState('')
    const [keySaving, setKeySaving] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    const { messages, sendMessage, status, error } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/ai/chat',
            body: { roomId, provider },
        }),
    })

    const isLoading = status === 'submitted' || status === 'streaming'

    // Check consent status when panel opens
    useEffect(() => {
        if (!open) return
        fetch(`/api/ai/consent?roomId=${roomId}`)
            .then((r) => r.json())
            .then((data) => setConsented(data.consented))
            .catch(() => setConsented(false))
    }, [open, roomId])

    // Load stored keys
    useEffect(() => {
        if (!open) return
        loadKeys()
    }, [open, roomId])

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    // Auto-select provider based on available keys
    useEffect(() => {
        if (storedKeys.length > 0 && !storedKeys.find((k) => k.provider === provider)) {
            setProvider(storedKeys[0].provider)
        }
    }, [storedKeys, provider])

    async function loadKeys() {
        try {
            const res = await fetch(`/api/ai/keys?roomId=${roomId}`)
            const data = await res.json()
            setStoredKeys(data.keys || [])
        } catch {
            // ignore
        }
    }

    async function handleConsent() {
        const res = await fetch('/api/ai/consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId }),
        })
        if (res.ok) {
            setConsented(true)
        }
    }

    async function handleSaveKey() {
        if (!newKeyValue.trim()) return
        setKeySaving(true)
        try {
            await fetch('/api/ai/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, provider: newKeyProvider, apiKey: newKeyValue }),
            })
            setNewKeyValue('')
            await loadKeys()
        } finally {
            setKeySaving(false)
        }
    }

    async function handleDeleteKey(keyProvider: AiProvider) {
        await fetch('/api/ai/keys', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, provider: keyProvider }),
        })
        await loadKeys()
    }

    function handleSend() {
        const text = inputValue.trim()
        if (!text || isLoading) return
        setInputValue('')
        sendMessage({ text })
    }

    const hasActiveKey = storedKeys.some((k) => k.provider === provider)

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Bot className="w-4 h-4" />
                    AI Assistant
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[450px] sm:w-[500px] flex flex-col p-0">
                <SheetHeader className="p-4 pb-0">
                    <SheetTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        AI Assistant
                    </SheetTitle>
                </SheetHeader>

                {consented === false && (
                    <div className="flex-1 flex items-center justify-center p-6">
                        <div className="text-center max-w-sm space-y-4">
                            <Shield className="w-12 h-12 mx-auto text-muted-foreground" />
                            <h3 className="font-semibold text-lg">AI Assistant Consent</h3>
                            <p className="text-sm text-muted-foreground">
                                The AI assistant will analyze documents and engagement data in this room
                                using your own API key. Your data is sent directly to the AI provider
                                you select. OpenVault does not store conversation history.
                            </p>
                            <ul className="text-sm text-muted-foreground text-left space-y-1">
                                <li>- Document text may be sent to the AI provider for analysis</li>
                                <li>- Engagement metrics may be shared for insights</li>
                                <li>- Your API key is encrypted and stored per-room</li>
                                <li>- The AI cannot access data outside this room</li>
                            </ul>
                            <Button onClick={handleConsent} className="w-full">
                                I Understand, Enable AI
                            </Button>
                        </div>
                    </div>
                )}

                {consented === true && (
                    <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
                        <TabsList className="mx-4 mt-2">
                            <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
                            <TabsTrigger value="settings" className="flex-1">
                                <Settings className="w-3.5 h-3.5 mr-1" />
                                Settings
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 m-0 p-0">
                            {/* Provider selector */}
                            <div className="px-4 py-2 border-b flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Provider:</span>
                                <Select value={provider} onValueChange={(v) => setProvider(v as AiProvider)}>
                                    <SelectTrigger className="h-7 text-xs w-auto">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {storedKeys.map((k) => (
                                            <SelectItem key={k.provider} value={k.provider}>
                                                {PROVIDER_LABELS[k.provider]}
                                            </SelectItem>
                                        ))}
                                        {storedKeys.length === 0 && (
                                            <SelectItem value={provider} disabled>
                                                No keys configured
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Messages */}
                            <ScrollArea className="flex-1 px-4 py-2" ref={scrollRef}>
                                <div className="space-y-4">
                                    {messages.length === 0 && (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Bot className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                            <p className="text-sm font-medium">How can I help with your data room?</p>
                                            <div className="mt-4 space-y-2 text-xs">
                                                <p className="text-muted-foreground/70">Try asking:</p>
                                                <button
                                                    type="button"
                                                    className="block w-full text-left px-3 py-1.5 rounded border hover:bg-muted/50 transition-colors"
                                                    onClick={() => setInputValue('What documents am I missing for fundraising?')}
                                                >
                                                    &quot;What documents am I missing?&quot;
                                                </button>
                                                <button
                                                    type="button"
                                                    className="block w-full text-left px-3 py-1.5 rounded border hover:bg-muted/50 transition-colors"
                                                    onClick={() => setInputValue('Who are my most engaged investors?')}
                                                >
                                                    &quot;Who are my most engaged investors?&quot;
                                                </button>
                                                <button
                                                    type="button"
                                                    className="block w-full text-left px-3 py-1.5 rounded border hover:bg-muted/50 transition-colors"
                                                    onClick={() => setInputValue('Summarize my data room readiness')}
                                                >
                                                    &quot;Summarize my data room readiness&quot;
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {messages.map((m) => {
                                        const text = getMessageText(m)
                                        if (!text) return null
                                        return (
                                            <div
                                                key={m.id}
                                                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                                                        m.role === 'user'
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-muted'
                                                    }`}
                                                >
                                                    <div className="whitespace-pre-wrap">{text}</div>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                                                <span className="animate-pulse">Thinking...</span>
                                            </div>
                                        </div>
                                    )}

                                    {error && (
                                        <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                                            {error.message || 'An error occurred. Check your API key and try again.'}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>

                            {/* Input */}
                            <div className="p-4 border-t flex gap-2">
                                <Textarea
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={hasActiveKey ? 'Ask about your data room...' : 'Configure an API key in Settings first'}
                                    disabled={!hasActiveKey || isLoading}
                                    className="min-h-[40px] max-h-[120px] resize-none text-sm"
                                    rows={1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSend()
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    size="icon"
                                    disabled={!hasActiveKey || isLoading || !inputValue.trim()}
                                    onClick={handleSend}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="settings" className="flex-1 m-0 p-4 space-y-6 overflow-auto">
                            {/* API Keys */}
                            <div>
                                <h3 className="font-medium mb-3 flex items-center gap-2">
                                    <Key className="w-4 h-4" />
                                    API Keys
                                </h3>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Add your own API keys to use the AI assistant. Keys are encrypted
                                    and stored per-room. They are never logged or shared.
                                </p>

                                {/* Existing keys */}
                                {storedKeys.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {storedKeys.map((k) => (
                                            <div
                                                key={k.provider}
                                                className="flex items-center justify-between rounded border p-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {PROVIDER_LABELS[k.provider]}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        ****{k.keyHint}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => handleDeleteKey(k.provider)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add key form */}
                                <div className="space-y-2 rounded border p-3">
                                    <Select
                                        value={newKeyProvider}
                                        onValueChange={(v) => setNewKeyProvider(v as AiProvider)}
                                    >
                                        <SelectTrigger className="h-8 text-sm">
                                            <SelectValue placeholder="Select provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="anthropic">{PROVIDER_LABELS.anthropic}</SelectItem>
                                            <SelectItem value="openai">{PROVIDER_LABELS.openai}</SelectItem>
                                            <SelectItem value="google">{PROVIDER_LABELS.google}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        type="password"
                                        placeholder="Paste API key..."
                                        value={newKeyValue}
                                        onChange={(e) => setNewKeyValue(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                    <Button
                                        size="sm"
                                        className="w-full"
                                        onClick={handleSaveKey}
                                        disabled={!newKeyValue.trim() || keySaving}
                                    >
                                        {keySaving ? 'Saving...' : 'Save Key'}
                                    </Button>
                                </div>
                            </div>

                            {/* Usage info */}
                            <div>
                                <h3 className="font-medium mb-2">About</h3>
                                <div className="text-xs text-muted-foreground space-y-2">
                                    <p>
                                        The AI assistant can analyze your data room structure,
                                        read document content, check engagement metrics, and
                                        compare your room against fundraising best practices.
                                    </p>
                                    <p>
                                        All analysis is scoped to this room only. The AI cannot
                                        access other rooms, external websites, or any data outside
                                        your data room.
                                    </p>
                                    <p>
                                        API calls are made directly from our server to your selected
                                        provider. You are responsible for any costs incurred.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                {consented === null && (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-sm text-muted-foreground animate-pulse">Loading...</span>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
