import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/activation') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')

  // Rediriger vers /login si pas de session et route protégée
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Rediriger vers / si déjà connecté et sur une page auth
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Vérifier is_active (uniquement sur les navigations de page, pas les requêtes fetch/RSC)
  // Cela évite une requête DB sur chaque sous-requête Next.js
  const isPageNavigation = request.headers.get('accept')?.includes('text/html')
  if (user && !isAuthRoute && isPageNavigation) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .single()

    if (profile && !profile.is_active) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'compte_desactive')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
