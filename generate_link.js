const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // First ensure the user exists
  const email = "test-agent@example.com";
  let { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  let user = users?.find(u => u.email === email);
  
  if (!user) {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: { name: 'Test Agent' }
    });
    if (createError) {
      console.error("Error creating user:", createError);
      return;
    }
    user = createData.user;
  }

  // Ensure they are in the users table
  await supabase.from('users').upsert({
    uid: user.id,
    display_name: 'Test Agent',
    email: email,
    role: 'admin'
  });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
  });

  if (error) {
    console.error("Error generating link:", error);
  } else {
    console.log("MAGIC_LINK=" + data.properties.action_link);
  }
}
main();
