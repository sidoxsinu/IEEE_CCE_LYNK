import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const authError = searchParams.get('error')
  const authErrorDescription = searchParams.get('error_description')
  
  if (authError) {
    return NextResponse.redirect(`${origin}/?error=${authError}&desc=${authErrorDescription}`)
  }

  if (!code) {
    // If there's no code and no error, maybe it returned a hash fragment?
    return NextResponse.redirect(`${origin}/?error=NoCode_CheckURLParams`)
  }

  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
  if (sessionError) {
    return NextResponse.redirect(`${origin}/?error=${sessionError.message}`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.redirect(`${origin}/?error=NoUserFound`)
  }

  const email = user.email.toLowerCase()
  const displayName = user.user_metadata?.full_name || email.split('@')[0]
  const photoUrl = user.user_metadata?.avatar_url || ''

  try {
    // 1. Check if user already exists
    const { data: existingUser } = await adminClient
      .from('users')
      .select('uid')
      .eq('uid', user.id)
      .single()

    if (existingUser) {
      // Returning user, just redirect to home
      return NextResponse.redirect(`${origin}/home`)
    }

    // 2. Check if email is in the admin config
    const { data: configData } = await adminClient
      .from('config')
      .select('admins')
      .eq('id', 'main')
      .single()

    const admins = configData?.admins || []
    const isAdmin = admins.includes(email)
    const role = isAdmin ? 'admin' : 'user'

    // 3. Find matching participant record
    const { data: participantData } = await adminClient
      .from('participants')
      .select('id, claimed_by_uid')
      .eq('email', email)
      .limit(1)
      .single()

    if (!isAdmin && !participantData) {
      // User is not an admin and not a participant
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/?error=NotRegistered`)
    }

    if (participantData && participantData.claimed_by_uid && participantData.claimed_by_uid !== user.id) {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/?error=AlreadyClaimed`)
    }

    const participantId = participantData ? participantData.id : null

    // 4. Create the users record
    const { error: userInsertError } = await adminClient
      .from('users')
      .insert({
        uid: user.id,
        display_name: displayName,
        email: email,
        photo_url: photoUrl,
        participant_id: participantId,
        role: role
      })

    if (userInsertError) throw userInsertError

    // 5. Link the participant to the user
    if (participantId) {
      const { error: participantUpdateError } = await adminClient
        .from('participants')
        .update({ claimed_by_uid: user.id })
        .eq('id', participantId)
        
      if (participantUpdateError) throw participantUpdateError
    }

    return NextResponse.redirect(`${origin}/home`)

  } catch (err) {
    console.error('Error during auth callback setup:', err)
    return NextResponse.redirect(`${origin}/?error=ServerError`)
  }
}
