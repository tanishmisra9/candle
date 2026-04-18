import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { cn } from "../lib/cn";

const navItems = [
  { to: "/trials", label: "Trials" },
  { to: "/literature", label: "Literature" },
  { to: "/ask", label: "Ask" },
];

export function GlassNav() {
  const { scrollY } = useScroll();
  const prefersReducedMotion = useReducedMotion();
  const [compact, setCompact] = useState(false);
  const location = useLocation();
  const bandOpacity = useSpring(useTransform(scrollY, [0, 20, 108], [0, 0, 0.52]), {
    stiffness: 180,
    damping: 28,
  });
  const bandTranslateY = useSpring(useTransform(scrollY, [0, 108], [-10, 0]), {
    stiffness: 180,
    damping: 28,
  });

  useEffect(() => {
    let lastValue = 0;
    return scrollY.on("change", (value) => {
      const goingDown = value > lastValue;
      if (value < 16) {
        setCompact(false);
      } else if (goingDown && value > 42) {
        setCompact(true);
      } else if (!goingDown) {
        setCompact(false);
      }
      lastValue = value;
    });
  }, [scrollY]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 px-7 pt-5 md:px-10">
      <motion.div
        aria-hidden="true"
        style={{
          opacity: bandOpacity,
          y: bandTranslateY,
        }}
        className="top-glass-band"
      />
      <motion.header
        animate={{
          y: compact ? 4 : 0,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="pointer-events-auto mx-auto flex max-w-[1360px] items-center justify-between gap-5"
      >
        <Link to="/">
          <motion.div
            animate={{
              paddingTop: compact ? 11 : 14,
              paddingBottom: compact ? 11 : 14,
              paddingLeft: compact ? 16 : 18,
              paddingRight: compact ? 16 : 18,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="glass-nav flex items-center gap-3 rounded-[18px]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(232,163,61,0.14)]">
              <Flame size={16} strokeWidth={1.5} className="text-accent" />
            </div>
            <span className="text-[16px] font-medium tracking-[-0.01em] text-text">
              Candle
            </span>
          </motion.div>
        </Link>

        <motion.nav
          animate={{
            paddingTop: compact ? 5 : 6,
            paddingBottom: compact ? 5 : 6,
            paddingLeft: compact ? 5 : 6,
            paddingRight: compact ? 5 : 6,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="glass-nav flex items-center gap-1 rounded-full"
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "relative rounded-full px-3.5 py-2.5 text-[14px] font-medium transition-colors duration-200",
                  isActive ? "text-text" : "text-muted hover:text-text",
                  compact && "px-3",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="active-nav-pill"
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.18 }
                        : { type: "spring", stiffness: 260, damping: 28 }
                    }
                    className="absolute inset-0 rounded-full bg-[rgba(232,163,61,0.14)] shadow-[inset_0_0_0_1px_rgba(232,163,61,0.18)]"
                  />
                ) : null}
                <span className="relative z-10">{item.label}</span>
              </NavLink>
            );
          })}
        </motion.nav>
      </motion.header>
    </div>
  );
}
