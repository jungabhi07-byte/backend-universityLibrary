
// Cloudflare Worker for KU Library Login System
// Save as api.js

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // Change to your domain in production
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route handling
      switch (path) {
        case '/api/login':
          return await handleLogin(request, env, corsHeaders);
        
        case '/api/register':
          return await handleRegister(request, env, corsHeaders);
        
        case '/api/logout':
          return await handleLogout(request, env, corsHeaders);
        
        case '/api/verify':
          return await handleVerify(request, env, corsHeaders);
        
        case '/api/profile':
          return await handleProfile(request, env, corsHeaders);
        
        case '/api/change-password':
          return await handleChangePassword(request, env, corsHeaders);
        
        case '/api/reset-password':
          return await handleResetPassword(request, env, corsHeaders);
        
        case '/api/users':
          return await handleUsers(request, env, corsHeaders);
        
        case '/api/health':
          return jsonResponse({ 
            status: 'healthy', 
            service: 'KU Library Auth API',
            version: '1.0.0'
          }, 200, corsHeaders);
        
        default:
          return jsonResponse({ 
            message: 'KU Library Authentication API',
            endpoints: [
              '/api/login',
              '/api/register',
              '/api/logout',
              '/api/verify',
              '/api/profile',
              '/api/health'
            ]
          }, 200, corsHeaders);
      }
    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse({ 
        error: 'Internal Server Error',
        message: error.message 
      }, 500, corsHeaders);
    }
  }
};

// Helper function for JSON responses
function jsonResponse(data, status = 200, corsHeaders) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// ==================== USER DATABASE ====================
// In production, use Cloudflare D1, KV, or external database
// For demo, we'll use in-memory storage

// Demo users (in production, store hashed passwords!)
const DEMO_USERS = {
  // Staff account
  'staff@kulibrary.edu.np': {
    id: 'STAFF001',
    username: 'library_staff',
    email: 'staff@kulibrary.edu.np',
    password: 'Staff@2024', // Demo password - hash in production!
    role: 'staff',
    fullName: 'Library Administrator',
    department: 'Library Services',
    phone: '+977-9801234567',
    joinDate: '2023-01-15',
    permissions: ['manage_books', 'manage_users', 'view_reports', 'issue_books', 'return_books'],
    lastLogin: null,
    isActive: true,
    avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
  },
  
  // Student account
  'student@kulibrary.edu.np': {
    id: 'STU2024001',
    username: 'ku_student',
    email: 'student@kulibrary.edu.np',
    password: 'Student@2024', // Demo password - hash in production!
    role: 'student',
    fullName: 'Aarav Sharma',
    studentId: 'KU2024001',
    department: 'Computer Engineering',
    semester: '6th',
    phone: '+977-9812345678',
    joinDate: '2024-01-20',
    activeLoans: 2,
    maxLoans: 5,
    permissions: ['borrow_books', 'view_catalog', 'view_profile', 'renew_books'],
    lastLogin: null,
    isActive: true,
    avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
  },
  
  // Faculty account (bonus)
  'faculty@kulibrary.edu.np': {
    id: 'FAC2024001',
    username: 'ku_faculty',
    email: 'faculty@kulibrary.edu.np',
    password: 'Faculty@2024',
    role: 'faculty',
    fullName: 'Dr. Rajesh Kumar',
    facultyId: 'FAC001',
    department: 'Computer Science',
    designation: 'Associate Professor',
    phone: '+977-9823456789',
    joinDate: '2022-08-10',
    activeLoans: 0,
    maxLoans: 10,
    permissions: ['borrow_books', 'view_catalog', 'view_reports', 'reserve_books'],
    lastLogin: null,
    isActive: true,
    avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
  }
};

// Active sessions storage (use KV in production)
const sessions = new Map();

// Generate session token
function generateToken(userId) {
  return `kulibrary_${userId}_${Date.now()}_${Math.random().toString(36).substr(2)}`;
}

// ==================== API HANDLERS ====================

// Login handler
async function handleLogin(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const { email, password } = await request.json();
    
    // Validate input
    if (!email || !password) {
      return jsonResponse({ 
        error: 'Validation failed',
        message: 'Email and password are required'
      }, 400, corsHeaders);
    }

    // Find user
    const user = DEMO_USERS[email];
    
    if (!user) {
      return jsonResponse({ 
        error: 'Authentication failed',
        message: 'Invalid email or password'
      }, 401, corsHeaders);
    }

    // Check password (in production, use bcrypt or similar)
    if (user.password !== password) {
      return jsonResponse({ 
        error: 'Authentication failed',
        message: 'Invalid email or password'
      }, 401, corsHeaders);
    }

    // Check if user is active
    if (!user.isActive) {
      return jsonResponse({ 
        error: 'Account suspended',
        message: 'Your account has been deactivated. Please contact administrator.'
      }, 403, corsHeaders);
    }

    // Generate session token
    const token = generateToken(user.id);
    const session = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    // Store session (in production, use KV store)
    sessions.set(token, session);

    // Update last login
    user.lastLogin = new Date().toISOString();

    // Return user data (without password)
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      department: user.department || user.department,
      permissions: user.permissions,
      avatar: user.avatar,
      studentId: user.studentId,
      facultyId: user.facultyId,
      semester: user.semester,
      designation: user.designation,
      activeLoans: user.activeLoans || 0,
      maxLoans: user.maxLoans || 5,
      joinDate: user.joinDate,
      lastLogin: user.lastLogin
    };

    return jsonResponse({
      success: true,
      message: 'Login successful',
      token: token,
      user: userResponse,
      session: {
        expiresAt: session.expiresAt,
        role: user.role,
        permissions: user.permissions
      }
    }, 200, corsHeaders);

  } catch (error) {
    return jsonResponse({ 
      error: 'Login failed',
      message: error.message 
    }, 400, corsHeaders);
  }
}

// Verify token handler
async function handleVerify(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ 
      error: 'Authentication required',
      message: 'No token provided'
    }, 401, corsHeaders);
  }

  const token = authHeader.split(' ')[1];
  const session = sessions.get(token);

  if (!session) {
    return jsonResponse({ 
      error: 'Invalid token',
      message: 'Session expired or invalid'
    }, 401, corsHeaders);
  }

  // Check if session expired
  if (new Date(session.expiresAt) < new Date()) {
    sessions.delete(token);
    return jsonResponse({ 
      error: 'Session expired',
      message: 'Please login again'
    }, 401, corsHeaders);
  }

  // Get user data
  const user = Object.values(DEMO_USERS).find(u => u.id === session.userId);
  
  if (!user) {
    return jsonResponse({ 
      error: 'User not found',
      message: 'User account no longer exists'
    }, 404, corsHeaders);
  }

  // Return user data (without password)
  const userResponse = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    department: user.department || user.department,
    permissions: user.permissions,
    avatar: user.avatar
  };

  return jsonResponse({
    success: true,
    message: 'Token is valid',
    user: userResponse,
    session: {
      expiresAt: session.expiresAt,
      role: user.role
    }
  }, 200, corsHeaders);
}

// Logout handler
async function handleLogout(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ 
      error: 'Authentication required'
    }, 401, corsHeaders);
  }

  const token = authHeader.split(' ')[1];
  
  // Remove session
  sessions.delete(token);

  return jsonResponse({
    success: true,
    message: 'Logged out successfully'
  }, 200, corsHeaders);
}

// User profile handler
async function handleProfile(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ 
      error: 'Authentication required'
    }, 401, corsHeaders);
  }

  const token = authHeader.split(' ')[1];
  const session = sessions.get(token);

  if (!session) {
    return jsonResponse({ 
      error: 'Invalid session'
    }, 401, corsHeaders);
  }

  // Get user data
  const user = Object.values(DEMO_USERS).find(u => u.id === session.userId);
  
  if (!user) {
    return jsonResponse({ 
      error: 'User not found'
    }, 404, corsHeaders);
  }

  // Return detailed profile (without password)
  const profile = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    department: user.department || user.department,
    phone: user.phone,
    joinDate: user.joinDate,
    lastLogin: user.lastLogin,
    isActive: user.isActive,
    avatar: user.avatar,
    
    // Student specific
    studentId: user.studentId,
    semester: user.semester,
    activeLoans: user.activeLoans || 0,
    maxLoans: user.maxLoans || 5,
    
    // Faculty specific
    facultyId: user.facultyId,
    designation: user.designation,
    
    // Staff specific
    permissions: user.permissions,
    
    // Statistics
    totalLoans: 24, // Mock data
    currentLoans: user.activeLoans || 0,
    overdueLoans: 0, // Mock data
    totalFines: 0 // Mock data
  };

  return jsonResponse({
    success: true,
    profile: profile
  }, 200, corsHeaders);
}

// Change password handler
async function handleChangePassword(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ 
      error: 'Authentication required'
    }, 401, corsHeaders);
  }

  const token = authHeader.split(' ')[1];
  const session = sessions.get(token);

  if (!session) {
    return jsonResponse({ 
      error: 'Invalid session'
    }, 401, corsHeaders);
  }

  try {
    const { currentPassword, newPassword } = await request.json();
    
    // Validate
    if (!currentPassword || !newPassword) {
      return jsonResponse({ 
        error: 'Validation failed',
        message: 'Both current and new password are required'
      }, 400, corsHeaders);
    }

    if (newPassword.length < 6) {
      return jsonResponse({ 
        error: 'Validation failed',
        message: 'New password must be at least 6 characters'
      }, 400, corsHeaders);
    }

    // Get user
    const user = Object.values(DEMO_USERS).find(u => u.id === session.userId);
    
    if (!user) {
      return jsonResponse({ 
        error: 'User not found'
      }, 404, corsHeaders);
    }

    // Check current password
    if (user.password !== currentPassword) {
      return jsonResponse({ 
        error: 'Current password is incorrect'
      }, 400, corsHeaders);
    }

    // Update password (in production, hash this!)
    user.password = newPassword;

    return jsonResponse({
      success: true,
      message: 'Password changed successfully'
    }, 200, corsHeaders);

  } catch (error) {
    return jsonResponse({ 
      error: 'Failed to change password',
      message: error.message 
    }, 400, corsHeaders);
  }
}

// Register new user (demo only - in production, this would have validation)
async function handleRegister(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const userData = await request.json();
    
    // Basic validation
    if (!userData.email || !userData.password || !userData.fullName) {
      return jsonResponse({ 
        error: 'Validation failed',
        message: 'Email, password, and full name are required'
      }, 400, corsHeaders);
    }

    // Check if user already exists
    if (DEMO_USERS[userData.email]) {
      return jsonResponse({ 
        error: 'User already exists',
        message: 'A user with this email already exists'
      }, 409, corsHeaders);
    }

    // Generate user ID based on role
    let userId, role = userData.role || 'student';
    
    if (role === 'staff') {
      userId = `STAFF${Date.now().toString().substr(-4)}`;
    } else if (role === 'faculty') {
      userId = `FAC${Date.now().toString().substr(-4)}`;
    } else {
      userId = `STU${Date.now().toString().substr(-4)}`;
    }

    // Create new user
    const newUser = {
      id: userId,
      username: userData.email.split('@')[0],
      email: userData.email,
      password: userData.password, // Hash in production!
      role: role,
      fullName: userData.fullName,
      department: userData.department || 'General',
      phone: userData.phone || '',
      joinDate: new Date().toISOString().split('T')[0],
      permissions: role === 'staff' 
        ? ['manage_books', 'view_reports']
        : ['borrow_books', 'view_catalog'],
      lastLogin: null,
      isActive: true,
      avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
    };

    // Add to demo users (in production, save to database)
    DEMO_USERS[userData.email] = newUser;

    // Generate token
    const token = generateToken(newUser.id);
    const session = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      permissions: newUser.permissions,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    sessions.set(token, session);

    // Return response without password
    const { password, ...userWithoutPassword } = newUser;

    return jsonResponse({
      success: true,
      message: 'Registration successful',
      token: token,
      user: userWithoutPassword
    }, 201, corsHeaders);

  } catch (error) {
    return jsonResponse({ 
      error: 'Registration failed',
      message: error.message 
    }, 400, corsHeaders);
  }
}

// Get all users (staff only)
async function handleUsers(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ 
      error: 'Authentication required'
    }, 401, corsHeaders);
  }

  const token = authHeader.split(' ')[1];
  const session = sessions.get(token);

  if (!session) {
    return jsonResponse({ 
      error: 'Invalid session'
    }, 401, corsHeaders);
  }

  // Check if user is staff
  if (session.role !== 'staff') {
    return jsonResponse({ 
      error: 'Permission denied',
      message: 'Staff access required'
    }, 403, corsHeaders);
  }

  // Get all users without passwords
  const users = Object.values(DEMO_USERS).map(user => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });

  return jsonResponse({
    success: true,
    users: users,
    count: users.length
  }, 200, corsHeaders);
}

// Reset password handler
async function handleResetPassword(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const { email } = await request.json();
    
    if (!email) {
      return jsonResponse({ 
        error: 'Email is required'
      }, 400, corsHeaders);
    }

    // Check if user exists
    const user = DEMO_USERS[email];
    
    if (!user) {
      // For security, don't reveal if user exists or not
      return jsonResponse({
        success: true,
        message: 'If your email exists in our system, you will receive a reset link'
      }, 200, corsHeaders);
    }

    // In production, send email with reset link
    // For demo, just return success
    
    return jsonResponse({
      success: true,
      message: 'Password reset instructions sent to your email',
      demoNote: 'In production, an email would be sent with reset link'
    }, 200, corsHeaders);

  } catch (error) {
    return jsonResponse({ 
      error: 'Password reset failed',
      message: error.message 
    }, 400, corsHeaders);
  }
}
