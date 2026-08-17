import { NavLink, useLocation } from 'react-router'
import { AppIcon } from './AppIcon'

interface SidebarLinkProps {
  to: string
  label: string
  icon: React.ComponentProps<typeof AppIcon>['name']
  end?: boolean
}

export function SidebarLink({ to, label, icon, end }: SidebarLinkProps): React.JSX.Element {
  const location = useLocation()

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
      onClick={(event) => {
        if (location.pathname === to) {
          event.preventDefault()
        }
      }}
    >
      <AppIcon name={icon} />
      <span>{label}</span>
    </NavLink>
  )
}
