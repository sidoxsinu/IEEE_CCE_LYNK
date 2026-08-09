import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { Participant } from '@/lib/types';

function generateUniqueCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude I, O, 0, 1 for readability
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('uid', session.user.id)
      .single();

    if (profileError || userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { rows } = await request.json();

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid input format' }, { status: 400 });
    }

    // Format rows into participants
    const participants = rows.map((row: any) => {
      const name = row['Name']?.trim() || '';
      const email = row['Email']?.trim() || '';
      const department = row['Department']?.trim() || '';
      const paperTitle = row['Paper Title']?.trim() || '';
      const interest = row['Interest']?.trim() || row['Fun Fact']?.trim() || '';
      
      if (!name || !email || !department || !paperTitle) {
        throw new Error(`Row missing required fields: ${JSON.stringify(row)}`);
      }

      const firstLetter = name.charAt(0).toUpperCase();

      let clueText = `A participant from ${department} who authored '${paperTitle}'. First name starts with ${firstLetter}.`;
      if (interest) {
        clueText += ` ...and is into ${interest}.`;
      }

      return {
        name,
        email,
        department,
        paper_title: paperTitle,
        interest,
        clue_text: clueText,
        unique_code: generateUniqueCode(),
        claimed_by_uid: null,
        connections_made_count: 0,
      };
    });

    const adminDb = createAdminClient();

    // Safe re-import: only insert new rows, skip existing emails (preserves unique_code).
    const { data: insertedData, error: insertError } = await adminDb
      .from('participants')
      .upsert(participants, {
        onConflict: 'email',
        ignoreDuplicates: true,
      })
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: insertedData?.length ?? 0 });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
