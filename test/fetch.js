export async function fetchObject() {
  return {
    code: 0,
    data: {
      expire_time: 100,
      book_list: [
        {
          id: '111',
          book_title: 'The book title',
          price: 12.8,
        },
        {
          id: '222',
          book_title: 'The second book title',
          price: 5.8,
        },
      ],
    },
  };
}

export async function fetchArray() {
  return [
    {
      id: '111',
      book_title: 'The book title',
      price: 12.8,
    },
    {
      id: '222',
      book_title: 'The second book title',
      price: 5.8,
    },
  ];
}
