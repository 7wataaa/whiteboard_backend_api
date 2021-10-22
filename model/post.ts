import { User } from './user';

export type PostArgs = {
  text: string;
  author: User;
};

/**
 * Roomに投げる内容
 */
export class Post {
  isEmptyText: boolean;

  text: string;

  author: User;

  constructor({ text, author }: PostArgs) {
    this.text = text;
    this.author = author;
    this.isEmptyText = text.length == 0;
  }
}
