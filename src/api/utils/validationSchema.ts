import { z } from "zod";

const connectionSchema = z.object({
  body: z.object({
    host: z
      .string({
        required_error: "O host é obrigatório.",
        invalid_type_error: "O host deve ser uma string."
      })
      .trim()
      .min(1, { message: "O host nao pode ser vazio." }),
    port: z
      .number({
        required_error: "A porta é obrigatória.",
        invalid_type_error: "A porta deve ser um número."
      })
      .int({ message: "A porta deve ser um número inteiro." })
      .min(1, { message: "A porta deve ser no mínimo 1." })
      .max(65535, { message: "A porta deve ser no máximo 65535." }),
    connectionTimeout: z
      .number({
        required_error: "O timeout de conexão é obrigatório.",
        invalid_type_error: "O timeout de conexão deve ser um número."
      })
      .int({ message: "O timeout de conexão deve ser um número inteiro." })
      .min(300, {
        message: "O timeout de conexão deve ser no mínimo 300 segundos."
      })
      .max(3600, {
        message: "O timeout de conexão deve ser no máximo 3600 segundos."
      }),
    authentication: z
      .object({
        username: z
          .string({
            invalid_type_error: "O username deve ser uma string."
          })
          .trim()
          .min(1, { message: "O username nao pode ser vazio." }),
        password: z
          .string({
            invalid_type_error: "A senha deve ser uma string."
          })
          .min(1, { message: "A senha nao pode ser vazia." })
      })
      .optional()
  })
});

const cacheKeySchema = z.object({
  params: z.object({
    key: z
      .string({
        required_error: "A chave é obrigatória.",
        invalid_type_error: "A chave deve ser uma string."
      })
      .min(1, { message: "A chave não pode ser vazia." })
  })
});

const cacheValueSchema = z.object({
  body: z.object({
    key: z
      .string({
        required_error: "A chave é obrigatória.",
        invalid_type_error: "A chave deve ser uma string."
      })
      .min(1, { message: "A chave não pode ser vazia." }),
    value: z
      .string({
        required_error: "O valor é obrigatório.",
        invalid_type_error: "O valor deve ser uma string."
      })
      .min(1, { message: "O valor não pode ser vazio." }),
    expires: z
      .number({
        invalid_type_error: "O tempo de expiração deve ser um número."
      })
      .int({ message: "O tempo de expiração deve ser um número inteiro." })
      .min(0, { message: "O tempo de expiração deve ser maior ou igual a 0." })
      .optional()
  })
});

export { connectionSchema, cacheKeySchema, cacheValueSchema };
