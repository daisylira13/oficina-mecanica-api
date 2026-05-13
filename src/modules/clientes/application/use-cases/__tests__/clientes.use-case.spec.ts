import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientesUseCase } from '../clientes.use-case';
import { CLIENTE_REPOSITORY } from '../../../domain/repositories/cliente.repository.interface';
import { TipoDocumento } from '../../../domain/enums/tipo-documento.enum';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByDocumento: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('ClientesUseCase', () => {
  let useCase: ClientesUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesUseCase,
        { provide: CLIENTE_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    useCase = module.get<ClientesUseCase>(ClientesUseCase);
    jest.clearAllMocks();
  });

  describe('criar', () => {
    it('deve criar cliente com sucesso', async () => {
      const dto = {
        nome: 'João',
        documento: '12345678909',
        tipoDocumento: TipoDocumento.CPF,
        telefone: '11999999999',
        email: 'joao@email.com',
      };
      mockRepository.findByDocumento.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({ id: '1', ...dto });

      const result = await useCase.criar(dto);

      expect(result).toHaveProperty('id');
      expect(mockRepository.create).toHaveBeenCalledWith(dto);
    });

    it('deve rejeitar cliente com documento duplicado', async () => {
      const dto = {
        nome: 'João',
        documento: '12345678909',
        tipoDocumento: TipoDocumento.CPF,
        telefone: '11999999999',
        email: 'joao@email.com',
      };
      mockRepository.findByDocumento.mockResolvedValue({ id: '1' });

      await expect(useCase.criar(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('buscarPorId', () => {
    it('deve retornar cliente existente', async () => {
      mockRepository.findById.mockResolvedValue({ id: '1', nome: 'João' });

      const result = await useCase.buscarPorId('1');

      expect(result.nome).toBe('João');
    });

    it('deve lançar exceção para cliente inexistente', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(useCase.buscarPorId('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('buscarPorDocumento', () => {
    it('deve retornar cliente por documento', async () => {
      mockRepository.findByDocumento.mockResolvedValue({
        id: '1',
        documento: '12345678909',
      });

      const result = await useCase.buscarPorDocumento('12345678909');
      expect(result.documento).toBe('12345678909');
    });

    it('deve lançar exceção para documento inexistente', async () => {
      mockRepository.findByDocumento.mockResolvedValue(null);

      await expect(useCase.buscarPorDocumento('00000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
