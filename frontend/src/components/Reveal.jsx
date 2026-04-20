import { useEffect, useMemo, useRef, useState } from "react";

const defaultObserverOptions = {
  root: null,
  rootMargin: "-10% 0px -10% 0px",
  threshold: 0.12,
};

const Reveal = ({
  as = "div",
  className = "",
  delayMs = 0,
  children,
  observerOptions,
}) => {
  const Tag = as;
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    return !("IntersectionObserver" in window);
  });

  const options = useMemo(
    () => ({ ...defaultObserverOptions, ...(observerOptions || {}) }),
    [observerOptions]
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, options);

    observer.observe(node);
    return () => observer.disconnect();
  }, [options]);

  return (
    <Tag
      ref={ref}
      className={["reveal", visible ? "is-visible" : "", className].filter(Boolean).join(" ")}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
