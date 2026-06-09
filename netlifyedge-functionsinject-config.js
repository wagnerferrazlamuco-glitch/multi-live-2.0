export default async (request, context) => {
     const response = await context.next();
     const html = await response.text();

     const injected = html.replace(
       "%%SUPABASE_URL%%", Deno.env.get("SUPABASE_URL") || ""
     ).replace(
       "%%SUPABASE_KEY%%", Deno.env.get("SUPABASE_KEY") || ""
     );

     return new Response(injected, response);
   };

   export const config = { path: "/" };