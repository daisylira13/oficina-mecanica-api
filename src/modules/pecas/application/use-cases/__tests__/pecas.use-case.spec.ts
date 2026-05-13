import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PecasUseCase } from '../pecas.use-case';
import { PECA_REPOSITORY } from '../../../domain/repositories/peca.repository.interface';
import { BusinessException } from '../../../../../shared/exceptions';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('PecasUseCase', () => {
  let useCase: PecasUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PecasUseCase,
        { provide: PECA_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    useCase = module.get<PecasUseCase>(PecasUseCase);
    jest.clearAllMocks();
  });

  describe('entradaEstoque', () => {
    it('deve adicionar quantidade ao estoque', async () => {
      mockRepository.findById.mockResolvedValue({
        id: '1',
        quantidadeEstoque: 10,
        quantidadeReservada: 0,
      });
      mockRepository.update.mockResolvedValue({
        id: '1',
        quantidadeEstoque: 20,
      });

      await useCase.entradaEstoque('1', 10);
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        quantidadeEstoque: 20,
      });
    });
  });

  describe('reservar', () => {
    it('deve reservar peça quando há estoque disponível', async () => {
      mockRepository.findById.mockResolvedValue({
        id: '1',
        quantidadeEstoque: 10,
        quantidadeReservada: 2,
      });
      mockRepository.update.mockResolvedValue({
        id: '1',
        quantidadeReservada: 4,
      });

      await useCase.reservar('1', 2);
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        quantidadeReservada: 4,
      });
    });

    it('deve rejeitar reserva quando estoque insuficiente', async () => {
      mockRepository.findById.mockResolvedValue({
        id: '1',
        quantidadeEstoque: 10,
        quantidadeReservada: 8,
      });

      await expect(useCase.reservar('1', 5)).rejects.toThrow(BusinessException);
    });
  });

  describe('baixarEstoque', () => {
    it('deve baixar estoque com sucesso', async () => {
      mockRepository.findById.mockResolvedValue({
        id: '1',
        quantidadeEstoque: 10,
        quantidadeReservada: 5,
      });
      mockRepository.update.mockResolvedValue({
        id: '1',
        quantidadeEstoque: 5,
        quantidadeReservada: 0,
      });

      await useCase.baixarEstoque('1', 5);
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        quantidadeEstoque: 5,
        quantidadeReservada: 0,
      });
    });

    it('deve rejeitar baixa quando estoque insuficiente', async () => {
      mockRepository.findById.mockResolvedValue({
        id: '1',
        quantidadeEstoque: 3,
        quantidadeReservada: 0,
      });

      await expect(useCase.baixarEstoque('1', 5)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('buscarPorId', () => {
    it('deve lançar exceção para peça inexistente', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(useCase.buscarPorId('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
