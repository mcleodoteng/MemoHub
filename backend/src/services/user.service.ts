import { UserRepository } from "../repositories/user.repository.js";

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getAllUsers() {
    return this.userRepository.findAll();
  }

  async getUserById(id: string) {
    return this.userRepository.findById(id);
  }

  async updateUser(id: string, data: any) {
    // Only allow updating certain fields
    const allowedFields = [
      "name",
      "bio",
      "avatar",
      "department",
      "status",
      "role",
      "twoFactorEnabled",
      "sessionTimeoutMinutes",
    ];
    const updateData: any = {};

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("No valid fields to update");
    }

    return this.userRepository.update(id, updateData);
  }
}
