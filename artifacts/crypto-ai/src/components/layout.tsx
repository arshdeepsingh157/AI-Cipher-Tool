import { Link, useLocation } from "wouter";
import { Terminal, Bot, History, ShieldCheck, Hash, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/",        label: "Workspace",       icon: Terminal  },
    { href: "/hash",    label: "Hash Generator",  icon: Hash      },
    { href: "/password",label: "Password Tools",  icon: ShieldCheck },
    { href: "/stego",   label: "Steganography",   icon: Eye       },
    { href: "/ai",      label: "AI Assistant",    icon: Bot       },
    { href: "/history", label: "History",         icon: History   },
  ];

  return (
    <div className="dark min-h-screen bg-background text-foreground flex text-sm">
      <nav className="w-64 border-r border-border bg-card p-4 flex flex-col gap-4 fixed h-full">
        <div className="flex items-center gap-2 px-2 py-4 mb-4">
          <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold font-mono">
            CY
          </div>
          <span className="font-bold text-lg tracking-tight">CYPHER<span className="text-primary">.ai</span></span>
        </div>
        
        <div className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                location === item.href 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      
      <main className="flex-1 ml-64 p-8 relative">
        <div className="fixed inset-0 pointer-events-none opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay z-50"></div>
        {children}
      </main>
    </div>
  );
}
