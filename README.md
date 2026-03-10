# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/14042ea5-75ea-4616-850c-27b00d187540

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/14042ea5-75ea-4616-850c-27b00d187540) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Set up environment variables (see Environment Setup below)
cp .env.example .env
# Then edit .env and add your Supabase credentials

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Environment Setup

This project requires Supabase configuration. You'll need to set up environment variables before running the application.

### Getting Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** > **API**
4. Copy the following values:
   - **Project URL** → use for `VITE_SUPABASE_URL`
   - **Publishable Key** (anon/public key) → use for `VITE_SUPABASE_PUBLISHABLE_KEY`

### Setting Up Environment Variables

1. Copy the example environment file:
   ```sh
   cp .env.example .env
   ```

2. Open `.env` and replace the placeholder values with your actual Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-actual-publishable-key
   ```

3. Save the file. The `.env` file is already in `.gitignore`, so your secrets won't be committed to version control.

**Note:** Never commit your `.env` file or share your publishable keys publicly. The `.env.example` file is safe to commit as it only contains placeholder values.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/14042ea5-75ea-4616-850c-27b00d187540) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
