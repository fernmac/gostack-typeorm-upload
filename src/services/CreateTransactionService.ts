import { getCustomRepository, getRepository } from 'typeorm';

import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';

import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const category_id = await this.getCategoryId(category);

    const { income } = await transactionsRepository.getBalance();

    if (type === 'outcome' && value > income) {
      throw new AppError('Outcome value is not valid', 400);
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }

  private async getCategoryId(title: string): Promise<string> {
    const categoriesRepository = getRepository(Category);

    const categorySearch = await categoriesRepository.findOne({
      where: { title: title },
    });

    if (categorySearch != undefined) {
      return categorySearch.id;
    } else {
      const newCategory = categoriesRepository.create({
        title: title,
      });

      const { id } = await categoriesRepository.save(newCategory);

      return id;
    }
  }
}

export default CreateTransactionService;
