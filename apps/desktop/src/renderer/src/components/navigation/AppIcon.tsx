interface AppIconProps {
  name: 'today' | 'settings' | 'box' | 'inbox-tray' | 'history'
}

const paths: Record<AppIconProps['name'], React.ReactNode> = {
  today: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  box: (
    <>
      <path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2m2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-9 4h4" />
    </>
  ),
  'inbox-tray': (
    <>
      <path d="M4 4h16v16H4zM4 13h4l2 3h4l2-3h4" />
    </>
  ),
  history: (
    <>
      <path d="M9 14h6M10 17.5h4M9 11h6M15.09 10c.18-.65.66-1.25 1.16-1.75a6 6 0 1 0-8.5 0c.5.5.98 1.1 1.16 1.75" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l-2-.7-.5-1.2.9-1.9-2.1-2.1-1.9.9-1.2-.5-.7-2h-3l-.7 2-1.2.5-1.9-.9-2.1 2.1.9 1.9-.5 1.2-2 .7v3l2 .7.5 1.2-.9 1.9 2.1 2.1 1.9-.9 1.2.5.7 2h3l.7-2 1.2-.5 1.9.9 2.1-2.1-.9-1.9.5-1.2z" />
    </>
  ),
}

export function AppIcon({ name }: AppIconProps): React.JSX.Element {
  return (
    <svg className="app-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
