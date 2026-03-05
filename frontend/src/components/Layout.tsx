import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/history", label: "History", icon: "📅" },
  { to: "/captures", label: "Captures", icon: "📸" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(true);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col md:flex-row">
      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between bg-gray-800 border-b border-gray-700 px-4 py-3">
        <h1 className="text-lg font-bold text-blue-400">antWeather</h1>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-gray-300 p-1"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav className="md:hidden bg-gray-800 border-b border-gray-700 px-4 pb-3 flex flex-col gap-1 z-50">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-sm ${isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
                }`
              }
            >
              <span className="text-lg">{l.icon}</span> <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      {/* Desktop sidebar */}
      <nav className={`hidden md:flex bg-gray-800 border-r border-gray-700 p-4 flex-col gap-2 shrink-0 transition-all duration-300 ${desktopExpanded ? 'w-56' : 'w-20 items-center'}`}>
        <div className={`flex items-center mb-6 w-full ${desktopExpanded ? 'justify-between' : 'justify-center'}`}>
          {desktopExpanded && <h1 className="text-lg font-bold text-blue-400 truncate pr-2">antWeather</h1>}
          <button
            onClick={() => setDesktopExpanded(!desktopExpanded)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 focus:outline-none shrink-0"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {desktopExpanded ? (
                <>
                  <path d="M11 19l-7-7 7-7" />
                  <path d="M19 19l-7-7 7-7" />
                </>
              ) : (
                <>
                  <path d="M13 5l7 7-7 7" />
                  <path d="M5 5l7 7-7 7" />
                </>
              )}
            </svg>
          </button>
        </div>

        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            title={!desktopExpanded ? l.label : undefined}
            className={({ isActive }) =>
              `flex items-center px-3 py-2 rounded text-sm transition-colors whitespace-nowrap overflow-hidden ${desktopExpanded ? 'gap-3' : 'justify-center w-full px-0'
              } ${isActive
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-700"
              }`
            }
          >
            <span className="text-lg shrink-0 flex items-center justify-center">{l.icon}</span>
            {desktopExpanded && <span>{l.label}</span>}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
