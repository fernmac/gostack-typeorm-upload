import { getRepository, getCustomRepository, In } from 'typeorm';

import fs from 'fs';

import csvParse from 'csv-parse';

import Transaction from '../models/Transaction';

import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  filePath: string;
}

interface TransactionCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  public async execute({ filePath }: Request): Promise<Transaction[]> {
    const transactionsCSV: TransactionCSV[] = [];

    const categories: string[] = [];

    const contentFile = fs.createReadStream(filePath).pipe(
      csvParse({
        delimiter: ',',
        from_line: 2,
      }),
    );

    await new Promise(resolve => {
      contentFile
        .on('data', data => {
          const [title, type, value, category] = data.map((content: String) =>
            content.trim(),
          );

          categories.push(category);

          transactionsCSV.push({ title, type, value, category });
        })
        .on('end', resolve);
    });

    await this.addCategories(categories);

    const transactions = await this.addTransactions(transactionsCSV);

    await fs.promises.unlink(filePath);

    return transactions;
  }

  private async addCategories(categories: string[]): Promise<void> {
    const categoriesRepository = getRepository(Category);

    const categorySearch = (
      await categoriesRepository.find({
        where: { title: In(categories) },
      })
    ).map(categoryName => categoryName.title);

    const categoriesCreate = categories
      .filter(category => !categorySearch.includes(category))
      .filter((value, index, self) => {
        return self.indexOf(value) === index;
      });

    const newCategories = categoriesRepository.create(
      categoriesCreate.map(categoryName => ({ title: categoryName })),
    );

    await categoriesRepository.save(newCategories);
  }

  private async addTransactions(
    transactions: TransactionCSV[],
  ): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const categoriesRepository = getRepository(Category);

    const categories = (await categoriesRepository.find()).map(category => ({
      id: category.id,
      title: category.title,
      created_at: category.created_at,
      updated_at: category.updated_at,
    }));

    const newTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        value: transaction.value,
        type: transaction.type,
        category: categories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(newTransactions);

    return newTransactions;
  }
}

export default ImportTransactionsService;
