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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col md:flex-row">
      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between bg-gray-800 border-b border-gray-700 px-4 py-3">
        <h1 className="text-lg font-bold text-blue-400">Rain Monitor</h1>
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
        <nav className="md:hidden bg-gray-800 border-b border-gray-700 px-4 pb-3 flex flex-col gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
                }`
              }
            >
              {l.icon} {l.label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-56 bg-gray-800 border-r border-gray-700 p-4 flex-col gap-1 shrink-0">
        <h1 className="text-lg font-bold mb-4 text-blue-400">Rain Monitor</h1>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm ${isActive
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-700"
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
