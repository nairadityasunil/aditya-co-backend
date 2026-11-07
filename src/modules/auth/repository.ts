import AdminUser, { IAdminUser } from './model';

class AdminUserRepository {
  public async findByEmail(email: string): Promise<IAdminUser | null> {
    return AdminUser.findOne({ email }).select('+password');
  }

  public async findById(id: string): Promise<IAdminUser | null> {
    return AdminUser.findById(id);
  }

  public async findByIdWithPassword(id: string): Promise<IAdminUser | null> {
    return AdminUser.findById(id).select('+password');
  }

  public async create(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<IAdminUser> {
    return AdminUser.create(data);
  }

  public async updateLastLogin(id: string): Promise<void> {
    await AdminUser.findByIdAndUpdate(id, { lastLoginAt: new Date() });
  }

  public async count(): Promise<number> {
    return AdminUser.countDocuments();
  }
}

export default new AdminUserRepository();
