'use client'

import { useState, useEffect, useCallback } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Folder, ChevronRight, ChevronDown } from 'lucide-react'

type FolderNode = {
    id: string
    name: string
    parent_id: string | null
    children: FolderNode[]
}

type FolderPickerProps = {
    roomId: string
    selectedIds: string[]
    onChange: (ids: string[]) => void
}

function buildTree(folders: { id: string; name: string; parent_id: string | null }[]): FolderNode[] {
    const map = new Map<string, FolderNode>()
    for (const f of folders) {
        map.set(f.id, { ...f, children: [] })
    }

    const roots: FolderNode[] = []
    for (const node of map.values()) {
        if (node.parent_id && map.has(node.parent_id)) {
            map.get(node.parent_id)!.children.push(node)
        } else {
            roots.push(node)
        }
    }

    // Sort alphabetically at each level
    function sortChildren(nodes: FolderNode[]) {
        nodes.sort((a, b) => a.name.localeCompare(b.name))
        for (const n of nodes) {
            sortChildren(n.children)
        }
    }
    sortChildren(roots)

    return roots
}

function getDescendantIds(node: FolderNode): string[] {
    const ids: string[] = []
    for (const child of node.children) {
        ids.push(child.id)
        ids.push(...getDescendantIds(child))
    }
    return ids
}

function getAllIds(nodes: FolderNode[]): string[] {
    const ids: string[] = []
    for (const node of nodes) {
        ids.push(node.id)
        ids.push(...getDescendantIds(node))
    }
    return ids
}

function FolderTreeItem({
    node,
    depth,
    selectedSet,
    onToggle,
}: {
    node: FolderNode
    depth: number
    selectedSet: Set<string>
    onToggle: (id: string, descendants: string[], checked: boolean) => void
}) {
    const [expanded, setExpanded] = useState(true)
    const isChecked = selectedSet.has(node.id)
    const hasChildren = node.children.length > 0
    const descendants = getDescendantIds(node)

    return (
        <div>
            <div
                className="flex items-center gap-1.5 py-1 hover:bg-muted/50 rounded px-1 -mx-1"
                style={{ paddingLeft: `${depth * 1.25 + 0.25}rem` }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                        )}
                    </button>
                ) : (
                    <span className="w-4" />
                )}
                <Checkbox
                    id={`folder-${node.id}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => onToggle(node.id, descendants, !!checked)}
                />
                <Folder className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <label
                    htmlFor={`folder-${node.id}`}
                    className="text-sm cursor-pointer select-none truncate"
                >
                    {node.name}
                </label>
            </div>
            {hasChildren && expanded && (
                <div>
                    {node.children.map((child) => (
                        <FolderTreeItem
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            selectedSet={selectedSet}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export function FolderPicker({ roomId, selectedIds, onChange }: FolderPickerProps) {
    const [tree, setTree] = useState<FolderNode[]>([])
    const [allIds, setAllIds] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/rooms/${roomId}/folders`)
                const data = await res.json()
                const builtTree = buildTree(data.folders || [])
                setTree(builtTree)
                setAllIds(getAllIds(builtTree))
            } catch {
                // ignore
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [roomId])

    const selectedSet = new Set(selectedIds)

    const handleToggle = useCallback(
        (id: string, descendants: string[], checked: boolean) => {
            const next = new Set(selectedIds)
            if (checked) {
                next.add(id)
                for (const d of descendants) {
                    next.add(d)
                }
            } else {
                next.delete(id)
                for (const d of descendants) {
                    next.delete(d)
                }
            }
            onChange(Array.from(next))
        },
        [selectedIds, onChange]
    )

    if (loading) {
        return <p className="text-xs text-muted-foreground animate-pulse py-2">Loading folders...</p>
    }

    if (tree.length === 0) {
        return <p className="text-xs text-muted-foreground py-2">No folders in this room yet.</p>
    }

    const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id))
    const noneSelected = selectedIds.length === 0

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => onChange(allIds)}
                    disabled={allSelected}
                >
                    Select All
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => onChange([])}
                    disabled={noneSelected}
                >
                    Clear All
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                    {selectedIds.length} of {allIds.length} selected
                </span>
            </div>
            <div className="border rounded-md p-2 max-h-[240px] overflow-y-auto">
                {tree.map((node) => (
                    <FolderTreeItem
                        key={node.id}
                        node={node}
                        depth={0}
                        selectedSet={selectedSet}
                        onToggle={handleToggle}
                    />
                ))}
            </div>
        </div>
    )
}
