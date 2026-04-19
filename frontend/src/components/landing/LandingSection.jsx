import Reveal from "../Reveal";

const LandingSection = ({ id, kicker, title, subtitle, children, className = "" }) => {
  return (
    <section id={id} className={["scroll-mt-28 space-y-6", className].join(" ")}
      aria-label={typeof title === "string" ? title : undefined}
    >
      <Reveal className="space-y-3">
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        {title ? <h2 className="section-title">{title}</h2> : null}
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </Reveal>
      {children}
    </section>
  );
};

export default LandingSection;
