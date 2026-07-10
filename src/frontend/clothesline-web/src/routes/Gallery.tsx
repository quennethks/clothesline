import { useNavigate } from 'react-router'
import { AppBar } from '../components/AppBar'
import { Icon } from '../components/Icon'

// Photo capture/upload is M6 scope — this placeholder carries the prototype's
// gallery chrome so the Draft/Sent/Closed photo entry points land somewhere
// coherent (spec §6.2), but it holds no photos yet.
export function Gallery() {
  const navigate = useNavigate()

  return (
    <section>
      <AppBar
        title="Photos"
        onBack={() => navigate(-1)}
        actions={
          <button className="iconbtn ghost" type="button" aria-label="Add photo" title="Add photo" disabled>
            <Icon name="camera" />
          </button>
        }
      />

      <div className="screen-body">
        <div className="center-card">
          <div className="empty-note">
            <div className="mb-2" style={{ fontSize: '2rem', color: 'var(--aqua-300)' }}>
              <Icon name="images" />
            </div>
            No photos yet.
          </div>
        </div>
      </div>
    </section>
  )
}
