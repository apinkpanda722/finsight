type SupabaseAuthClient = {
  auth: {
    getSession: () => Promise<{ data: { session: unknown | null } }>
  }
}

export async function isAuthenticated(supabase: SupabaseAuthClient) {
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}
