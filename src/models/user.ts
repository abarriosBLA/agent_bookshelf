import Database from 'better-sqlite3';

export interface User {
  id: number;
  username: string;
  display_name: string;
  created_at: string;
}

export function getAllUsers(db: Database.Database): User[] {
  return db.prepare('SELECT * FROM users ORDER BY display_name').all() as User[];
}

export function getUserById(db: Database.Database, id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByUsername(db: Database.Database, username: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
}

export function createUser(
  db: Database.Database,
  username: string,
  displayName: string
): User {
  const stmt = db.prepare('INSERT INTO users (username, display_name) VALUES (?, ?)');
  const result = stmt.run(username, displayName);
  return getUserById(db, result.lastInsertRowid as number)!;
}

export function updateUser(
  db: Database.Database,
  id: number,
  data: { username?: string; displayName?: string }
): User | undefined {
  const existing = getUserById(db, id);
  if (!existing) return undefined;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.username !== undefined) {
    updates.push('username = ?');
    values.push(data.username);
  }
  if (data.displayName !== undefined) {
    updates.push('display_name = ?');
    values.push(data.displayName);
  }

  if (updates.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getUserById(db, id);
}

export function deleteUser(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}
