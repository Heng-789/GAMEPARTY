import React from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../services/firebase'

export function useAuth() {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false) })
    return () => unsub()
  }, [])

  return { user, loading }
}
