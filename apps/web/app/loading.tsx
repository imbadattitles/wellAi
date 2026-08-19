export default function Loading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true" aria-label="Загрузка">
      <div className="skeleton skeleton-hero" />
      <div className="skeleton-row">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
      <span className="visually-hidden">Загружаем страницу…</span>
    </main>
  );
}
