# MindMesh - Real-time Collaboration Chat

A modern real-time group chat application with AI assistance, built with React, PartyKit for real-time communication, and Supabase for data persistence.

## Features

- **Real-time Communication**: Powered by PartyKit for instant, low-latency messaging
- **Persistent Storage**: Supabase backend for reliable data storage and user management
- **AI Assistant**: Intelligent responses using Kluster.ai - mention @AI for help
- **User Authentication**: Secure signup/login with Supabase Auth
- **Room-based Collaboration**: Create and join rooms with shareable links
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Open Source**: Built with open-source technologies for transparency and extensibility

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Real-time**: PartyKit WebSocket infrastructure
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **AI**: Kluster.ai (Llama 3.1 8B Instruct)
- **Deployment**: Netlify (frontend) + Supabase (backend)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd mindmesh-chat
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and configure:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# PartyKit Configuration (Optional - will fallback to simulation)
VITE_PARTYKIT_HOST=mindmesh.your-username.partykit.dev
```

### 3. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/20250610114338_flat_heart.sql`
3. **IMPORTANT**: Configure authentication settings:
   - Go to Authentication > Settings in your Supabase dashboard
   - Enable "Enable email confirmations" (recommended)
   - Disable "Enable email confirmations" if you want instant signup
   - Make sure "Enable sign ups" is turned ON
4. Update your `.env` file with the Supabase credentials

### 4. Supabase Authentication Configuration

**Critical Setup Steps:**

1. **Enable Sign-ups**: 
   - Go to Authentication > Settings
   - Ensure "Enable sign ups" is turned ON
   - Set "Minimum password length" to 6 or higher

2. **Email Configuration** (Choose one):
   - **Option A - Instant Access**: Disable "Enable email confirmations" for immediate signup
   - **Option B - Secure**: Enable "Enable email confirmations" and configure SMTP settings

3. **Site URL Configuration**:
   - Set "Site URL" to your domain (e.g., `https://your-app.netlify.app`)
   - Add redirect URLs for development: `http://localhost:5173`

4. **Email Templates** (if using confirmations):
   - Customize the confirmation email template
   - Set the redirect URL to your application

### 5. PartyKit Setup (Optional)

1. Install PartyKit CLI: `npm install -g partykit`
2. Create a PartyKit project: `partykit init`
3. Deploy your PartyKit server: `partykit deploy`
4. Update `VITE_PARTYKIT_HOST` in your `.env` file

### 6. Run the Application

```bash
npm run dev
```

## Troubleshooting Authentication

### "Email signups are disabled" Error

This error occurs when sign-ups are disabled in Supabase. To fix:

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Settings
3. Scroll down to "User Signups"
4. Toggle "Enable sign ups" to ON
5. Save the changes

### Email Confirmation Issues

If users aren't receiving confirmation emails:

1. Check your Supabase SMTP settings
2. Verify the "Site URL" is correctly set
3. Check spam folders
4. Consider disabling email confirmations for development

### Authentication Flow

The app supports two authentication flows:

1. **With Email Confirmation** (Recommended for production):
   - User signs up → receives email → clicks link → can sign in
   
2. **Without Email Confirmation** (Good for development):
   - User signs up → immediately signed in

## Architecture

### Real-time Communication Flow

```
User Input → React Component → PartyKit Client → PartyKit Server → Other Clients
                                      ↓
                               Supabase Database (Persistence)
```

### Key Components

- **PartyKit Integration** (`src/lib/partykit.ts`): WebSocket connection management
- **Supabase Integration** (`src/lib/supabase.ts`): Database operations and auth
- **Chat Context** (`src/contexts/ChatContext.tsx`): State management for real-time chat
- **Auth Context** (`src/contexts/AuthContext.tsx`): User authentication and session management

## Database Schema

The application uses the following Supabase tables:

- **profiles**: User profiles (extends auth.users)
- **rooms**: Chat room metadata
- **room_participants**: Many-to-many relationship for room membership
- **messages**: Chat messages with user information

All tables have Row Level Security (RLS) enabled for data protection.

## Deployment

### Frontend (Netlify)
```bash
npm run build
# Deploy dist/ folder to Netlify
```

### Backend (Supabase)
1. Create Supabase project
2. Run database migrations
3. Configure authentication settings
4. Update environment variables

### Real-time (PartyKit)
```bash
partykit deploy
```

## Configuration

### Supabase Setup

1. **Create Project**: Go to [supabase.com](https://supabase.com) and create a new project
2. **Database Schema**: Run the SQL migration from `supabase/migrations/`
3. **Authentication**: Configure email/password authentication
4. **API Keys**: Copy your project URL and anon key to `.env`

### PartyKit Setup

1. **Install CLI**: `npm install -g partykit`
2. **Create Server**: Implement your PartyKit server for room-based messaging
3. **Deploy**: Use `partykit deploy` to deploy your server
4. **Configure**: Update `VITE_PARTYKIT_HOST` with your deployed URL

## API Reference

### PartyKit Messages

```typescript
interface PartyKitMessage {
  type: 'message' | 'user_joined' | 'user_left' | 'typing';
  data: any;
  userId: string;
  userName: string;
  userColor: string;
  timestamp: number;
}
```

### Supabase Schema

- **profiles**: User profiles and authentication
- **rooms**: Chat room metadata
- **room_participants**: Many-to-many relationship for room membership
- **messages**: Chat messages with user information

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Submit a pull request

## Security

- **Row Level Security**: Supabase RLS policies ensure users only access their data
- **Authentication**: Secure JWT-based authentication with Supabase Auth
- **Input Validation**: Client and server-side validation for all user inputs
- **CORS**: Proper CORS configuration for cross-origin requests

## Performance

- **Real-time**: PartyKit provides sub-100ms message delivery
- **Caching**: Intelligent caching of user data and room information
- **Pagination**: Message pagination for large chat histories
- **Optimistic Updates**: Immediate UI updates with server reconciliation

## Troubleshooting

### Connection Issues
- Check PartyKit host configuration
- Verify Supabase credentials
- Ensure network connectivity

### Authentication Problems
- Verify Supabase project settings
- Check email confirmation settings
- Review RLS policies
- Ensure "Enable sign ups" is turned ON

### Real-time Issues
- Test PartyKit connection directly
- Check browser WebSocket support
- Verify CORS configuration

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Create GitHub issues for bugs and feature requests
- **Community**: Join our discussions for help and collaboration

---

**MindMesh** - Open-source real-time collaboration, powered by modern web technologies.