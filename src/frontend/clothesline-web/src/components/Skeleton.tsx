// The screens below all wait on a live RxDB query that resolves in a tick or
// two. They used to render the bare word "Loading…", which flashes and then
// shoves the real layout in underneath it. A silhouette of the content that's
// coming holds the space instead, so nothing jumps when the data lands.
//
// role="status" + the visually-hidden label keeps it announced — a screen
// reader gets "Loading" where a sighted user gets the shimmer.

export function LoadScreenSkeleton() {
  return (
    <div className="screen-body" role="status">
      <span className="visually-hidden">Loading</span>
      <div className="center-card" aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: '55%', height: 26 }} />
        <div className="skeleton skeleton-line mt-3" style={{ width: '30%' }} />
        <div className="skeleton mt-2" style={{ height: 44, borderRadius: 12 }} />
        <div className="skeleton mx-auto mt-4" style={{ width: 96, height: 52 }} />
        {[0, 1, 2].map((row) => (
          <div className="skeleton-row" key={row}>
            <div className="skeleton-stack">
              <div className="skeleton skeleton-line" style={{ width: '45%' }} />
            </div>
            <div className="skeleton" style={{ width: 148, height: 44, borderRadius: 12 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoadListSkeleton() {
  return (
    <div className="screen-body" role="status">
      <span className="visually-hidden">Loading</span>
      <div className="desktop-grid" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div className="load-card" key={row}>
            <div className="skeleton skeleton-avatar" />
            <div className="skeleton-stack">
              <div className="skeleton skeleton-line" style={{ width: '60%' }} />
              <div className="skeleton skeleton-line" style={{ width: '35%', height: 10 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
