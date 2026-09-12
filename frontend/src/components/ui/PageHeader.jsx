const PageHeader = ({ eyebrow, title, description, actions = null, size = "large", children = null }) => (
  <header className={`page-header ${actions ? "has-actions" : ""}`}>
    <div className="min-w-0">
      {eyebrow ? <p className="team-eyebrow">{eyebrow}</p> : null}
      <h1 className={`page-title ${size === "compact" ? "is-compact" : ""}`}>{title}</h1>
      {description ? <p className="page-description">{description}</p> : null}
      {children}
    </div>
    {actions ? <div className="page-actions">{actions}</div> : null}
  </header>
);

export default PageHeader;
