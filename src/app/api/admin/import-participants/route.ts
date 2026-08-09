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
    const participants: Omit<Participant, 'id' | 'createdAt'>[] = rows.map((row: any) => {
      const name = row['Name'] || '';
      const email = row['Email'] || '';
      const department = row['Department'] || '';
      const paperTitle = row['Paper Title'] || '';
      const interest = row['Interest'] || row['Fun Fact'] || '';
      
      const firstLetter = name.trim().charAt(0).toUpperCase();

      let clueText = `A participant from ${department} who authored '${paperTitle}'. First name starts with ${firstLetter}.`;
      if (interest) {
        clueText += ` ...and is into ${interest}.`;
      }

      return {
        name,
        email,
        department,
        paperTitle,
        interest,
        clueText,
        uniqueCode: generateUniqueCode(),
        claimedByUid: null,
        connectionsMadeCount: 0,
      };
    });

    const adminDb = createAdminClient();
    
    const { data, error } = await adminDb
      .from('participants')
      .insert(participants)
      .select();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data.length });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
