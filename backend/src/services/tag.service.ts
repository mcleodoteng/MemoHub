import { TagRepository } from "../repositories/tag.repository.js";

export class TagService {
  private tagRepository: TagRepository;

  constructor() {
    this.tagRepository = new TagRepository();
  }

  async getTags(page = 1, limit = 50) {
    return this.tagRepository.findAll(page, limit);
  }

  async getTagById(id: string) {
    return this.tagRepository.findById(id);
  }

  async createTag(data: { name: string; category: string; color: string }) {
    // Check if tag already exists
    const existing = await this.tagRepository.findByName(data.name);
    if (existing) {
      throw new Error("Tag with this name already exists");
    }

    return this.tagRepository.create(data);
  }

  async updateTag(id: string, data: any) {
    return this.tagRepository.update(id, data);
  }

  async deleteTag(id: string) {
    return this.tagRepository.delete(id);
  }

  async getTagsWithCategories(page = 1, limit = 50) {
    const result = await this.tagRepository.findAll(page, limit);
    const categories = await this.tagRepository.getCategories();

    return {
      tags: result.tags,
      categories,
      pagination: result.pagination,
    };
  }
}
