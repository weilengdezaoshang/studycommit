import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { DeskItemLayout, DeskZone } from '@studycommit/common'
import deskRoom from './assets/desk-room-cozy-v3.webp'
import studyCompanion from './assets/study-companion-cozy-v1.webp'

export interface ThreeDeskCatalogItem {
  id: string
  name: string
  asset: string
  width: number
  height: number
  allowedZones: DeskZone[]
}

export interface ThreeDeskSceneHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
}

interface ThreeDeskSceneProps {
  items: ThreeDeskCatalogItem[]
  layouts: DeskItemLayout[]
  mode: 'browse' | 'edit'
  selectedId: string | null
  ambientMotion: boolean
  onSelect: (itemId: string | null) => void
  onItemMove: (itemId: string, x: number, y: number) => void
  onDragFinish: (before: DeskItemLayout[]) => void
  onReadyChange: (ready: boolean) => void
  onViewChange: (percent: number) => void
}

interface SceneRuntime {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  render: () => void
  sync: () => void
}

interface DragState {
  pointerId: number
  itemId: string
  startX: number
  startY: number
  startLayout: DeskItemLayout
  before: DeskItemLayout[]
}

const CAMERA_POSITION = new THREE.Vector3(0, 3.15, 8.7)
const CAMERA_TARGET = new THREE.Vector3(0, 2.7, -1.55)
const CAMERA_DISTANCE = CAMERA_POSITION.distanceTo(CAMERA_TARGET)

function cloneLayouts(layouts: DeskItemLayout[]): DeskItemLayout[] {
  return layouts.map((layout) => ({ ...layout }))
}

function buildIllustratedRoom(scene: THREE.Scene, texture: THREE.Texture): THREE.Mesh {
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(10.2, 6.8),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  )
  backdrop.position.set(0, 3, -2.2)
  backdrop.renderOrder = -100
  scene.add(backdrop)
  return backdrop
}

function buildCompanion(scene: THREE.Scene, texture: THREE.Texture): THREE.Group {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.55, 3.42),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.04,
      side: THREE.DoubleSide,
    }),
  )
  const group = new THREE.Group()
  group.name = 'study-companion'
  group.position.set(1.45, 3.24, -2.02)
  group.renderOrder = -20
  group.add(mesh)
  scene.add(group)
  return group
}

function buildContactShadow(width: number, height: number): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({
      color: '#6d4934',
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    }),
  )
  shadow.name = 'contact-shadow'
  shadow.position.set(0, -height / 2 + 0.025, -0.012)
  shadow.scale.set(width * 0.82, Math.max(0.08, height * 0.13), 1)
  return shadow
}

function buildSteam(): THREE.Group {
  const steam = new THREE.Group()
  steam.name = 'cup-steam'
  steam.visible = false
  for (let index = 0; index < 3; index += 1) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(index % 2 ? 0.04 : -0.04, 0.13, 0),
      new THREE.Vector3(index % 2 ? -0.03 : 0.03, 0.27, 0),
      new THREE.Vector3(0, 0.4, 0),
    ])
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(18))
    const material = new THREE.LineBasicMaterial({
      color: '#fff7e8',
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })
    const line = new THREE.Line(geometry, material)
    line.position.set((index - 1) * 0.11, 0.08, 0.025)
    line.userData.phase = index * 0.9
    steam.add(line)
  }
  return steam
}

function itemPosition(layout: DeskItemLayout): { x: number; y: number; z: number } {
  const zoneDepth = { wall: 0.08, shelf: 0.14, desktop: 0.28, foreground: 0.56 }[layout.zone]
  return {
    x: (layout.x - 0.5) * 9.1,
    y: 6.15 - layout.y * 6.15,
    z: -2.2 + zoneDepth,
  }
}

function ThreeDeskSceneInner(
  {
    items,
    layouts,
    mode,
    selectedId,
    ambientMotion,
    onSelect,
    onItemMove,
    onDragFinish,
    onReadyChange,
    onViewChange,
  }: ThreeDeskSceneProps,
  ref: Ref<ThreeDeskSceneHandle>,
): React.JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<SceneRuntime | null>(null)
  const layoutsRef = useRef(layouts)
  const modeRef = useRef(mode)
  const selectedIdRef = useRef(selectedId)
  const ambientMotionRef = useRef(ambientMotion)
  const onSelectRef = useRef(onSelect)
  const onItemMoveRef = useRef(onItemMove)
  const onDragFinishRef = useRef(onDragFinish)
  const onReadyChangeRef = useRef(onReadyChange)
  const onViewChangeRef = useRef(onViewChange)
  const [webglFailed, setWebglFailed] = useState(
    () => typeof window.WebGLRenderingContext === 'undefined',
  )

  useEffect(() => {
    layoutsRef.current = layouts
    modeRef.current = mode
    selectedIdRef.current = selectedId
    ambientMotionRef.current = ambientMotion
    onSelectRef.current = onSelect
    onItemMoveRef.current = onItemMove
    onDragFinishRef.current = onDragFinish
    onReadyChangeRef.current = onReadyChange
    onViewChangeRef.current = onViewChange
  }, [
    ambientMotion,
    layouts,
    mode,
    onDragFinish,
    onItemMove,
    onReadyChange,
    onSelect,
    onViewChange,
    selectedId,
  ])

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const runtime = runtimeRef.current
      if (!runtime) {
        return
      }
      const direction = runtime.camera.position.clone().sub(runtime.controls.target)
      const distance = Math.max(7.2, direction.length() * 0.88)
      runtime.camera.position
        .copy(runtime.controls.target)
        .add(direction.normalize().multiplyScalar(distance))
      runtime.controls.update()
      runtime.render()
    },
    zoomOut: () => {
      const runtime = runtimeRef.current
      if (!runtime) {
        return
      }
      const direction = runtime.camera.position.clone().sub(runtime.controls.target)
      const distance = Math.min(11.2, direction.length() * 1.12)
      runtime.camera.position
        .copy(runtime.controls.target)
        .add(direction.normalize().multiplyScalar(distance))
      runtime.controls.update()
      runtime.render()
    },
    resetView: () => {
      const runtime = runtimeRef.current
      if (!runtime) {
        return
      }
      runtime.camera.position.copy(CAMERA_POSITION)
      runtime.controls.target.copy(CAMERA_TARGET)
      runtime.controls.update()
      runtime.render()
    },
  }))

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || typeof window.WebGLRenderingContext === 'undefined') {
      onReadyChangeRef.current(false)
      return
    }

    let disposed = false
    let animationFrame = 0
    let lastAmbientFrame = 0
    let ambientWasActive = false
    let resizeObserver: ResizeObserver | null = null
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#eee4d1')

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
    camera.position.copy(CAMERA_POSITION)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    } catch {
      window.setTimeout(() => setWebglFailed(true), 0)
      onReadyChangeRef.current(false)
      return
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.className = 'desk-three-canvas'
    renderer.domElement.setAttribute('aria-label', '可交互的三维成长书桌')
    renderer.domElement.setAttribute('data-three-renderer', 'webgl')
    mount.append(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(CAMERA_TARGET)
    controls.enableDamping = false
    controls.enablePan = true
    controls.enableZoom = true
    controls.enableRotate = true
    controls.screenSpacePanning = true
    controls.minDistance = 7.2
    controls.maxDistance = 11.2
    controls.minPolarAngle = 1.43
    controls.maxPolarAngle = 1.56
    controls.minAzimuthAngle = -0.1
    controls.maxAzimuthAngle = 0.1
    controls.update()

    const roomObjects: THREE.Object3D[] = []
    const itemGroups = new Map<string, THREE.Group>()
    const itemMeshes: THREE.Mesh[] = []
    const textures: THREE.Texture[] = []
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let drag: DragState | null = null
    let companion: THREE.Group | null = null

    const render = () => renderer.render(scene, camera)
    const reportView = () => {
      const distance = camera.position.distanceTo(controls.target)
      onViewChangeRef.current(Math.round((CAMERA_DISTANCE / distance) * 100))
    }

    const sync = () => {
      const layoutById = new Map(layoutsRef.current.map((layout) => [layout.itemId, layout]))
      for (const item of items) {
        const group = itemGroups.get(item.id)
        if (!group) {
          continue
        }
        const layout = layoutById.get(item.id)
        group.visible = Boolean(layout)
        if (!layout) {
          continue
        }
        const position = itemPosition(layout)
        group.position.set(position.x, position.y, position.z + layout.zIndex * 0.002)
        group.rotation.set(0, 0, THREE.MathUtils.degToRad(layout.rotation))
        group.scale.set(layout.flipped ? -layout.scale : layout.scale, layout.scale, 1)
        group.renderOrder = layout.zIndex
        const selection = group.getObjectByName('selection')
        if (selection) {
          selection.visible = selectedIdRef.current === item.id && modeRef.current === 'edit'
        }
        const shadow = group.getObjectByName('contact-shadow')
        if (shadow) {
          shadow.visible = layout.zone !== 'wall'
        }
      }
      controls.enabled = modeRef.current === 'browse'
      render()
    }

    runtimeRef.current = { camera, controls, render, sync }

    const resize = () => {
      const rect = mount.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }
      camera.aspect = rect.width / rect.height
      camera.updateProjectionMatrix()
      renderer.setSize(rect.width, rect.height, false)
      render()
    }
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)

    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }
    const hitItem = (event: PointerEvent): string | null => {
      updatePointer(event)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster
        .intersectObjects(itemMeshes, false)
        .find((entry) => entry.object.visible)
      return typeof hit?.object.userData.itemId === 'string' ? hit.object.userData.itemId : null
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (modeRef.current !== 'edit') {
        return
      }
      const itemId = hitItem(event)
      onSelectRef.current(itemId)
      if (!itemId) {
        return
      }
      const startLayout = layoutsRef.current.find((layout) => layout.itemId === itemId)
      if (!startLayout) {
        return
      }
      renderer.domElement.setPointerCapture(event.pointerId)
      drag = {
        pointerId: event.pointerId,
        itemId,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: { ...startLayout },
        before: cloneLayouts(layoutsRef.current),
      }
      renderer.domElement.style.cursor = 'grabbing'
    }
    const handlePointerMove = (event: PointerEvent) => {
      if (drag && drag.pointerId === event.pointerId) {
        const rect = renderer.domElement.getBoundingClientRect()
        onItemMoveRef.current(
          drag.itemId,
          drag.startLayout.x + ((event.clientX - drag.startX) / rect.width) * 1.08,
          drag.startLayout.y + ((event.clientY - drag.startY) / rect.height) * 1.08,
        )
        return
      }
      if (modeRef.current === 'edit') {
        renderer.domElement.style.cursor = hitItem(event) ? 'grab' : 'default'
      }
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) {
        return
      }
      renderer.domElement.releasePointerCapture?.(event.pointerId)
      const before = drag.before
      drag = null
      renderer.domElement.style.cursor = modeRef.current === 'edit' ? 'grab' : 'default'
      onDragFinishRef.current(before)
    }
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      setWebglFailed(true)
      onReadyChangeRef.current(false)
    }

    renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    renderer.domElement.addEventListener('pointermove', handlePointerMove)
    renderer.domElement.addEventListener('pointerup', handlePointerUp)
    renderer.domElement.addEventListener('pointercancel', handlePointerUp)
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost)
    controls.addEventListener('change', () => {
      reportView()
      render()
    })

    const textureLoader = new THREE.TextureLoader()
    const uniqueItemAssets = [...new Set(items.map((item) => item.asset))]
    const itemTextures = new Map<string, THREE.Texture>()
    Promise.all([
      textureLoader.loadAsync(deskRoom).then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        textures.push(texture)
        roomObjects.push(buildIllustratedRoom(scene, texture))
      }),
      textureLoader.loadAsync(studyCompanion).then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        textures.push(texture)
        companion = buildCompanion(scene, texture)
        roomObjects.push(companion)
      }),
      ...uniqueItemAssets.map(async (asset) => {
        const texture = await textureLoader.loadAsync(asset)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        textures.push(texture)
        itemTextures.set(asset, texture)
      }),
    ])
      .then(() => {
        if (disposed) {
          return
        }
        for (const item of items) {
          const texture = itemTextures.get(item.asset)
          if (!texture) {
            throw new Error(`Desk texture did not load: ${item.id}`)
          }
          const width = item.width * 9.4
          const height = item.height * 6.4
          const geometry = new THREE.PlaneGeometry(width, height)
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.06,
            side: THREE.DoubleSide,
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.userData.itemId = item.id
          const shadow = buildContactShadow(width, height)

          const selection = new THREE.Mesh(
            new THREE.RingGeometry(0.04, 0.07, 24),
            new THREE.MeshBasicMaterial({
              color: '#587d72',
              transparent: true,
              opacity: 0.86,
              side: THREE.DoubleSide,
            }),
          )
          selection.name = 'selection'
          selection.position.set(0, height / 2 + 0.14, 0.018)
          selection.visible = false

          const group = new THREE.Group()
          group.userData.isPlant = item.name.includes('盆栽')
          group.add(shadow, mesh, selection)
          if (item.name.includes('茶杯')) {
            const steam = buildSteam()
            steam.position.set(0, height / 2 - 0.04, 0.02)
            group.add(steam)
          }
          scene.add(group)
          itemGroups.set(item.id, group)
          itemMeshes.push(mesh)
        }
        sync()
        resize()
        reportView()
        onReadyChangeRef.current(true)

        const animateAmbient = (time: number) => {
          animationFrame = window.requestAnimationFrame(animateAmbient)
          if (disposed || document.hidden || time - lastAmbientFrame < 33) {
            return
          }
          lastAmbientFrame = time
          const active = ambientMotionRef.current && modeRef.current === 'browse'
          if (!active && !ambientWasActive) {
            return
          }
          const seconds = time / 1000
          if (companion) {
            companion.position.y = 3.24 + (active ? Math.sin(seconds * 1.35) * 0.018 : 0)
            companion.rotation.z = active ? Math.sin(seconds * 0.72) * 0.0025 : 0
          }
          const layoutById = new Map(
            layoutsRef.current.map((layout) => [layout.itemId, layout] as const),
          )
          for (const item of items) {
            const group = itemGroups.get(item.id)
            const layout = layoutById.get(item.id)
            if (!group || !layout) {
              continue
            }
            const baseRotation = THREE.MathUtils.degToRad(layout.rotation)
            group.rotation.z =
              baseRotation +
              (active && group.userData.isPlant ? Math.sin(seconds * 0.8) * 0.012 : 0)
            const steam = group.getObjectByName('cup-steam')
            if (steam) {
              steam.visible = active
              for (const child of steam.children) {
                const phase = Number(child.userData.phase ?? 0)
                const progress = (seconds * 0.28 + phase) % 1
                child.position.y = 0.08 + progress * 0.22
                const material = (child as THREE.Line).material as THREE.LineBasicMaterial
                material.opacity = Math.sin(progress * Math.PI) * 0.38
              }
            }
          }
          ambientWasActive = active
          render()
        }
        animationFrame = window.requestAnimationFrame(animateAmbient)
      })
      .catch(() => {
        if (disposed) {
          return
        }
        setWebglFailed(true)
        onReadyChangeRef.current(false)
      })

    resize()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      onReadyChangeRef.current(false)
      runtimeRef.current = null
      resizeObserver?.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      renderer.domElement.removeEventListener('pointermove', handlePointerMove)
      renderer.domElement.removeEventListener('pointerup', handlePointerUp)
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp)
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
      for (const texture of textures) {
        texture.dispose()
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of materials) {
            material.dispose()
          }
        }
      })
      for (const object of roomObjects) {
        scene.remove(object)
      }
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [items])

  useEffect(() => {
    runtimeRef.current?.sync()
  }, [layouts, mode, selectedId])

  return (
    <div ref={mountRef} className="desk-three-scene" data-testid="desk-three-scene">
      {!webglFailed ? <span className="desk-three-scene__loading">正在布置三维空间…</span> : null}
      {webglFailed ? (
        <div className="desk-three-scene__fallback" role="status">
          <strong>当前设备无法开启三维书桌</strong>
          <span>学习计时和布局数据不会受影响，请更新图形驱动或关闭硬件加速后重试。</span>
        </div>
      ) : null}
    </div>
  )
}

export const ThreeDeskScene = forwardRef(ThreeDeskSceneInner)
