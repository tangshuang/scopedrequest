```
FRAGMENT DATA: {
  // 对字段进行注释
  // 注释必须独立一行，不可以跟在字段后面
  name: string
  age: number

  data: &DATA

  books: [
    {
      name: string
    },
    {
      title: string
    }
  ]
}
```

## project

描述部分不会有影响。

```
GET "..." -> {
  data: &DATA
}
```

## detail
```
POST "/api/contents/{id}" + {
  color: "red"
  age: number
} -> {
  id
}
```
