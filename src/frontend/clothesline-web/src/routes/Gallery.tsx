import { useNavigate } from 'react-router'

// Photo capture/upload is M6 scope — this placeholder exists now so the
// Draft/Sent/Closed screens' photo entry points have somewhere to go
// (spec §6.2).
export function Gallery() {
  const navigate = useNavigate()
  return (
    <main>
      <button type="button" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h1>Gallery</h1>
      <p>No photos yet.</p>
    </main>
  )
}
