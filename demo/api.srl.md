# project

描述部分不会有影响。

```
GET "..." -> {
  data: {
    // 对字段进行注释
    // 注释必须独立一行，不可以跟在字段后面
    name: string
    age: number
  }
}
```

# detail
```
POST "/api/contents/{id}" + {
  color: "red"
  age: number
} -> {
  id
}
```
