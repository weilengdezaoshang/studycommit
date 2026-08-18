import { Link, useLocation } from 'react-router'
import { AppIcon } from './AppIcon'

interface SidebarLinkProps {
  to: string
  label: string
  icon: React.ComponentProps<typeof AppIcon>['name']
  end?: boolean
  isActive?: (pathname: string) => boolean
}

export function SidebarLink({
  to,
  label,
  icon,
  end,
  isActive,
}: SidebarLinkProps): React.JSX.Element {
  const location = useLocation()
  const highlighted = isActive
    ? isActive(location.pathname)
    : end
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`)

  return (
    <Link
      to={to}
      className={`sidebar-link${highlighted ? ' sidebar-link--active' : ''}`}
      aria-current={highlighted ? 'page' : undefined}
      onClick={(event) => {
        if (location.pathname === to) {
          event.preventDefault()
        }
      }}
    >
      <AppIcon name={icon} />
      <span>{label}</span>
    </Link>
  )
}
