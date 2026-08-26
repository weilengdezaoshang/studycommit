import { useEffect, useMemo, useRef, useState } from 'react'
import {
  clampDeskItem,
  deskItemLayoutSchema,
  snapDeskCoordinate,
  type DeskItemLayout,
  type DeskZone,
} from '@studycommit/common'
import deskLamp from './assets/desk-lamp-minimal-v2.webp'
import deskFern from './assets/desk-fern-minimal-v2.webp'
import deskMug from './assets/desk-mug-minimal-v2.webp'
import deskBooks from './assets/desk-books-minimal-v2.webp'
import deskCat from './assets/desk-cat-minimal-v2.webp'
import deskClock from './assets/desk-clock-minimal-v2.webp'
import deskFrame from './assets/desk-frame-minimal-v2.webp'
import deskBox from './assets/desk-box-minimal-v2.webp'
import {
  ThreeDeskScene,
  type ThreeDeskCatalogItem,
  type ThreeDeskSceneHandle,
} from './ThreeDeskScene'

const DESK_STORAGE_KEY = 'studycommit:desk-demo:v1'

type DeskMode = 'browse' | 'edit'

interface DeskCatalogItem extends ThreeDeskCatalogItem {
  category: string
  defaultLayout: DeskItemLayout
}

const catalog: DeskCatalogItem[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: '黄铜台灯',
    category: '照明',
    asset: deskLamp,
    width: 0.25,
    height: 0.34,
    allowedZones: ['desktop', 'foreground'],
    defaultLayout: {
      itemId: '11111111-1111-4111-8111-111111111111',
      zone: 'desktop',
      x: 0.18,
      y: 0.7,
      rotation: 0,
      scale: 0.72,
      zIndex: 20,
      flipped: false,
    },
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: '蕨叶盆栽',
    category: '植物',
    asset: deskFern,
    width: 0.21,
    height: 0.3,
    allowedZones: ['shelf', 'desktop', 'foreground'],
    defaultLayout: {
      itemId: '22222222-2222-4222-8222-222222222222',
      zone: 'desktop',
      x: 0.82,
      y: 0.68,
      rotation: 0,
      scale: 0.68,
      zIndex: 26,
      flipped: false,
    },
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: '青釉茶杯',
    category: '日常',
    asset: deskMug,
    width: 0.13,
    height: 0.18,
    allowedZones: ['shelf', 'desktop', 'foreground'],
    defaultLayout: {
      itemId: '33333333-3333-4333-8333-333333333333',
      zone: 'desktop',
      x: 0.36,
      y: 0.73,
      rotation: -2,
      scale: 0.66,
      zIndex: 34,
      flipped: false,
    },
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: '布面书册',
    category: '书籍',
    asset: deskBooks,
    width: 0.26,
    height: 0.2,
    allowedZones: ['shelf', 'desktop', 'foreground'],
    defaultLayout: {
      itemId: '44444444-4444-4444-8444-444444444444',
      zone: 'desktop',
      x: 0.58,
      y: 0.77,
      rotation: 0,
      scale: 0.7,
      zIndex: 40,
      flipped: false,
    },
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: '陶瓷小猫',
    category: '纪念品',
    asset: deskCat,
    width: 0.16,
    height: 0.25,
    allowedZones: ['shelf', 'desktop', 'foreground'],
    defaultLayout: {
      itemId: '55555555-5555-4555-8555-555555555555',
      zone: 'desktop',
      x: 0.71,
      y: 0.68,
      rotation: 0,
      scale: 0.55,
      zIndex: 24,
      flipped: false,
    },
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: '静音座钟',
    category: '日常',
    asset: deskClock,
    width: 0.15,
    height: 0.19,
    allowedZones: ['shelf', 'desktop'],
    defaultLayout: {
      itemId: '66666666-6666-4666-8666-666666666666',
      zone: 'shelf',
      x: 0.67,
      y: 0.27,
      rotation: 0,
      scale: 0.54,
      zIndex: 12,
      flipped: false,
    },
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    name: '植物相框',
    category: '纪念品',
    asset: deskFrame,
    width: 0.16,
    height: 0.22,
    allowedZones: ['shelf', 'desktop'],
    defaultLayout: {
      itemId: '77777777-7777-4777-8777-777777777777',
      zone: 'desktop',
      x: 0.48,
      y: 0.68,
      rotation: -3,
      scale: 0.6,
      zIndex: 18,
      flipped: false,
    },
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    name: '木质收纳盒',
    category: '收纳',
    asset: deskBox,
    width: 0.24,
    height: 0.19,
    allowedZones: ['desktop', 'foreground'],
    defaultLayout: {
      itemId: '88888888-8888-4888-8888-888888888888',
      zone: 'foreground',
      x: 0.77,
      y: 0.84,
      rotation: 0,
      scale: 0.68,
      zIndex: 55,
      flipped: false,
    },
  },
]

const initialLayouts = catalog
  .filter(
    (item) =>
      !['77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888'].includes(
        item.id,
      ),
  )
  .map((item) => item.defaultLayout)

const cloneLayouts = (items: DeskItemLayout[]): DeskItemLayout[] =>
  items.map((item) => ({ ...item }))

function readSavedLayout(): DeskItemLayout[] {
  try {
    const raw = window.localStorage.getItem(DESK_STORAGE_KEY)
    if (!raw) {
      return cloneLayouts(initialLayouts)
    }
    const parsed = deskItemLayoutSchema.array().safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : cloneLayouts(initialLayouts)
  } catch {
    return cloneLayouts(initialLayouts)
  }
}

function inferredZone(item: DeskCatalogItem, y: number): DeskZone {
  const preferred: DeskZone =
    y < 0.18 ? 'wall' : y < 0.46 ? 'shelf' : y > 0.82 ? 'foreground' : 'desktop'
  return item.allowedZones.includes(preferred) ? preferred : item.allowedZones[0]
}

export function DeskDemoPage(): React.JSX.Element {
  const [mode, setMode] = useState<DeskMode>('browse')
  const [layouts, setLayouts] = useState<DeskItemLayout[]>(readSavedLayout)
  const [past, setPast] = useState<DeskItemLayout[][]>([])
  const [future, setFuture] = useState<DeskItemLayout[][]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saved, setSaved] = useState(true)
  const [sceneReady, setSceneReady] = useState(false)
  const [ambientMotion, setAmbientMotion] = useState(
    () =>
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [viewPercent, setViewPercent] = useState(100)
  const sceneRef = useRef<ThreeDeskSceneHandle>(null)
  const latestLayoutsRef = useRef(layouts)

  useEffect(() => {
    latestLayoutsRef.current = layouts
  }, [layouts])

  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [])
  const placedIds = useMemo(() => new Set(layouts.map((item) => item.itemId)), [layouts])
  const inventory = catalog.filter((item) => !placedIds.has(item.id))
  const selectedLayout = layouts.find((item) => item.itemId === selectedId) ?? null
  const selectedItem = selectedId ? (catalogById.get(selectedId) ?? null) : null

  const commit = (next: DeskItemLayout[]) => {
    setPast((items) => [...items.slice(-29), cloneLayouts(layouts)])
    setLayouts(next)
    setFuture([])
    setSaved(false)
  }

  const updateSelected = (patch: Partial<DeskItemLayout>) => {
    if (!selectedLayout || !selectedItem) {
      return
    }
    const nextItem = clampDeskItem(
      { ...selectedLayout, ...patch },
      { width: selectedItem.width, height: selectedItem.height },
    )
    commit(layouts.map((item) => (item.itemId === selectedLayout.itemId ? nextItem : item)))
  }

  const undo = () => {
    const previous = past.at(-1)
    if (!previous) {
      return
    }
    setFuture((items) => [cloneLayouts(layouts), ...items].slice(0, 30))
    setLayouts(cloneLayouts(previous))
    setPast((items) => items.slice(0, -1))
    setSaved(false)
  }

  const redo = () => {
    const next = future[0]
    if (!next) {
      return
    }
    setPast((items) => [...items.slice(-29), cloneLayouts(layouts)])
    setLayouts(cloneLayouts(next))
    setFuture((items) => items.slice(1))
    setSaved(false)
  }

  const save = () => {
    window.localStorage.setItem(DESK_STORAGE_KEY, JSON.stringify(layouts))
    setSaved(true)
  }

  const reset = () => {
    commit(cloneLayouts(initialLayouts))
    setSelectedId(null)
  }

  const addItem = (item: DeskCatalogItem) => {
    const nextLayout = {
      ...item.defaultLayout,
      zIndex: Math.max(0, ...layouts.map((layout) => layout.zIndex)) + 1,
    }
    commit([...layouts, nextLayout])
    setSelectedId(item.id)
  }

  const storeSelected = () => {
    if (!selectedId) {
      return
    }
    commit(layouts.filter((item) => item.itemId !== selectedId))
    setSelectedId(null)
  }

  const moveItem = (itemId: string, x: number, y: number) => {
    const catalogItem = catalogById.get(itemId)
    if (!catalogItem) {
      return
    }
    setLayouts((items) =>
      items.map((layout) => {
        if (layout.itemId !== itemId) {
          return layout
        }
        const nextY = snapDeskCoordinate(snapDeskCoordinate(y, 0.7), 0.78)
        return clampDeskItem(
          {
            ...layout,
            x: snapDeskCoordinate(snapDeskCoordinate(x, 0.5), 0.25),
            y: nextY,
            zone: inferredZone(catalogItem, nextY),
          },
          { width: catalogItem.width, height: catalogItem.height },
        )
      }),
    )
    setSaved(false)
  }

  const finishItemDrag = (before: DeskItemLayout[]) => {
    if (JSON.stringify(before) === JSON.stringify(latestLayoutsRef.current)) {
      return
    }
    setPast((items) => [...items.slice(-29), cloneLayouts(before)])
    setFuture([])
  }

  const handleItemKey = (event: React.KeyboardEvent<HTMLButtonElement>, layout: DeskItemLayout) => {
    if (mode !== 'edit') {
      return
    }
    const step = event.shiftKey ? 0.02 : 0.006
    const movement = {
      ArrowLeft: { x: layout.x - step },
      ArrowRight: { x: layout.x + step },
      ArrowUp: { y: layout.y - step },
      ArrowDown: { y: layout.y + step },
    }[event.key]
    if (movement) {
      event.preventDefault()
      setSelectedId(layout.itemId)
      const item = catalogById.get(layout.itemId)
      if (!item) {
        return
      }
      const next = clampDeskItem(
        { ...layout, ...movement },
        { width: item.width, height: item.height },
      )
      commit(layouts.map((candidate) => (candidate.itemId === layout.itemId ? next : candidate)))
    }
  }

  return (
    <section className="desk-demo" aria-label="成长书桌交互 Demo">
      <div className="desk-demo__heading">
        <div>
          <h2>把学习留下的东西，慢慢摆成自己的书桌</h2>
          <p>
            {mode === 'edit'
              ? '拖动物品调整位置，选中后可以旋转、缩放或收起。'
              : '浏览模式不会误触物品。放大看看你的收藏，或进入布置模式。'}
          </p>
        </div>
        <div className="desk-mode-switch" aria-label="书桌模式">
          <button
            type="button"
            aria-pressed={mode === 'browse'}
            onClick={() => {
              setMode('browse')
              setSelectedId(null)
            }}
          >
            浏览
          </button>
          <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
            布置
          </button>
        </div>
      </div>

      <div className={`desk-demo__workspace desk-demo__workspace--${mode}`}>
        <div className="desk-stage" data-testid="desk-stage">
          <ThreeDeskScene
            ref={sceneRef}
            items={catalog}
            layouts={layouts}
            mode={mode}
            selectedId={selectedId}
            ambientMotion={ambientMotion}
            onSelect={setSelectedId}
            onItemMove={moveItem}
            onDragFinish={finishItemDrag}
            onReadyChange={setSceneReady}
            onViewChange={setViewPercent}
          />

          <button
            type="button"
            className="desk-renderer-badge"
            aria-live="polite"
            aria-pressed={ambientMotion}
            onClick={() => setAmbientMotion((enabled) => !enabled)}
          >
            <span className={sceneReady ? 'is-ready' : ''} />
            {sceneReady
              ? ambientMotion
                ? '傍晚 · 安静陪学中'
                : '环境动效已暂停'
              : '正在准备陪学书桌'}
          </button>

          <div className="desk-camera-controls" aria-label="视图缩放">
            <button type="button" onClick={() => sceneRef.current?.zoomOut()} aria-label="缩小书桌">
              −
            </button>
            <span>{viewPercent}%</span>
            <button type="button" onClick={() => sceneRef.current?.zoomIn()} aria-label="放大书桌">
              ＋
            </button>
            <button type="button" onClick={() => sceneRef.current?.resetView()}>
              复位视图
            </button>
          </div>
        </div>

        <aside className="desk-drawer" aria-label="书桌编辑面板">
          {mode === 'edit' && selectedLayout && selectedItem ? (
            <div className="desk-inspector">
              <div>
                <span>{selectedItem.category}</span>
                <h3>{selectedItem.name}</h3>
              </div>
              <div className="desk-inspector__row" aria-label="旋转物品">
                <button
                  type="button"
                  onClick={() => updateSelected({ rotation: selectedLayout.rotation - 15 })}
                >
                  向左转
                </button>
                <output>{Math.round(selectedLayout.rotation)}°</output>
                <button
                  type="button"
                  onClick={() => updateSelected({ rotation: selectedLayout.rotation + 15 })}
                >
                  向右转
                </button>
              </div>
              <div className="desk-inspector__row" aria-label="缩放物品">
                <button
                  type="button"
                  onClick={() =>
                    updateSelected({ scale: Math.max(0.4, selectedLayout.scale - 0.1) })
                  }
                >
                  缩小
                </button>
                <output>{Math.round(selectedLayout.scale * 100)}%</output>
                <button
                  type="button"
                  onClick={() =>
                    updateSelected({ scale: Math.min(1.8, selectedLayout.scale + 0.1) })
                  }
                >
                  放大
                </button>
              </div>
              <div className="desk-inspector__row desk-inspector__row--layers">
                <button
                  type="button"
                  onClick={() => updateSelected({ zIndex: Math.max(0, selectedLayout.zIndex - 1) })}
                >
                  下移一层
                </button>
                <button
                  type="button"
                  onClick={() => updateSelected({ zIndex: selectedLayout.zIndex + 1 })}
                >
                  上移一层
                </button>
              </div>
              <div className="desk-inspector__secondary">
                <button
                  type="button"
                  onClick={() => updateSelected({ flipped: !selectedLayout.flipped })}
                >
                  水平翻转
                </button>
                <button type="button" onClick={storeSelected}>
                  收入收藏
                </button>
              </div>
              <p>方向键微调位置，按住 Shift 可加快移动。</p>
            </div>
          ) : (
            <div className="desk-drawer__intro">
              <h3>{mode === 'edit' ? '选择一件物品' : '成长收藏'}</h3>
              <p>
                {mode === 'edit'
                  ? '点击桌上的物品开始布置。'
                  : `桌上摆放了 ${layouts.length} 件学习纪念物。`}
              </p>
            </div>
          )}

          {mode === 'edit' ? (
            <div className="desk-object-list" aria-label="场景中的物品">
              <span>场景物品</span>
              <div>
                {layouts.map((layout) => {
                  const item = catalogById.get(layout.itemId)
                  if (!item) {
                    return null
                  }
                  const selected = selectedId === layout.itemId
                  return (
                    <button
                      key={layout.itemId}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${item.name}${selected ? '，已选中' : ''}`}
                      data-item-id={layout.itemId}
                      onClick={() => setSelectedId(layout.itemId)}
                      onKeyDown={(event) => handleItemKey(event, layout)}
                    >
                      <img src={item.asset} alt="" />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="desk-inventory">
            <div className="desk-inventory__heading">
              <h3>收藏抽屉</h3>
              <span>{inventory.length} 件</span>
            </div>
            {inventory.length ? (
              <div className="desk-inventory__grid">
                {inventory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={mode !== 'edit'}
                    onClick={() => addItem(item)}
                  >
                    <img src={item.asset} alt="" />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="desk-inventory__empty">所有收藏都摆在桌上了。</p>
            )}
          </div>

          <div className="desk-actions">
            <div>
              <button type="button" onClick={undo} disabled={!past.length || mode !== 'edit'}>
                撤销
              </button>
              <button type="button" onClick={redo} disabled={!future.length || mode !== 'edit'}>
                重做
              </button>
              <button type="button" onClick={reset} disabled={mode !== 'edit'}>
                复位
              </button>
            </div>
            <button type="button" className="desk-actions__save" onClick={save} disabled={saved}>
              {saved ? '已保存' : '保存布局'}
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
}
