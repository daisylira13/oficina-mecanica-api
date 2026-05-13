/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdensServicoUseCase } from '../ordens-servico.use-case';
import { PrismaService } from '../../../../../shared/database';
import { BusinessException } from '../../../../../shared/exceptions';
import { StatusOS } from '../../../domain/enums/status-os.enum';

const mockPrisma = {
  cliente: { findUnique: jest.fn() },
  veiculo: { findUnique: jest.fn() },
  servico: { findUnique: jest.fn() },
  peca: { findUnique: jest.fn(), update: jest.fn() },
  ordemServico: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  ordemServicoServico: { create: jest.fn() },
  ordemServicoPeca: { create: jest.fn() },
  orcamento: { create: jest.fn(), update: jest.fn() },
  historicoStatusOS: { create: jest.fn() },
  $transaction: jest.fn(),
};

const baseOS = {
  id: 'os-1',
  numero: 1,
  clienteId: 'cli-1',
  veiculoId: 'vei-1',
  status: StatusOS.RECEBIDA,
  valorTotal: 0,
  servicos: [],
  pecas: [],
  orcamentos: [],
  historico: [],
  cliente: { id: 'cli-1', nome: 'João' },
  veiculo: { id: 'vei-1', placa: 'ABC1D23', clienteId: 'cli-1' },
};

describe('OrdensServicoUseCase', () => {
  let useCase: OrdensServicoUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdensServicoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<OrdensServicoUseCase>(OrdensServicoUseCase);
    jest.clearAllMocks();
  });

  describe('criar', () => {
    it('deve criar OS com status RECEBIDA', async () => {
      mockPrisma.cliente.findUnique.mockResolvedValue({
        id: 'cli-1',
        nome: 'João',
      });
      mockPrisma.veiculo.findUnique.mockResolvedValue({
        id: 'vei-1',
        clienteId: 'cli-1',
      });

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const txMock = {
          ordemServico: {
            create: jest.fn().mockResolvedValue({
              id: 'os-1',
              status: StatusOS.RECEBIDA,
            }),
          },
          historicoStatusOS: { create: jest.fn() },
          servico: { findUnique: jest.fn() },
          peca: { findUnique: jest.fn() },
          ordemServicoServico: { create: jest.fn() },
          ordemServicoPeca: { create: jest.fn() },
        };
        await fn(txMock);
        return baseOS;
      });

      mockPrisma.ordemServico.findUnique.mockResolvedValue(baseOS);

      const result = await useCase.criar({
        clienteId: 'cli-1',
        veiculoId: 'vei-1',
      });

      expect(result.status).toBe(StatusOS.RECEBIDA);
    });

    it('deve rejeitar OS quando veículo não pertence ao cliente', async () => {
      mockPrisma.cliente.findUnique.mockResolvedValue({
        id: 'cli-1',
        nome: 'João',
      });
      mockPrisma.veiculo.findUnique.mockResolvedValue({
        id: 'vei-1',
        clienteId: 'cli-2',
      });

      await expect(
        useCase.criar({ clienteId: 'cli-1', veiculoId: 'vei-1' }),
      ).rejects.toThrow(BusinessException);
    });

    it('deve rejeitar OS quando cliente não existe', async () => {
      mockPrisma.cliente.findUnique.mockResolvedValue(null);

      await expect(
        useCase.criar({ clienteId: 'cli-999', veiculoId: 'vei-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('iniciarDiagnostico', () => {
    it('deve iniciar diagnóstico quando OS está RECEBIDA', async () => {
      const os = { ...baseOS, status: StatusOS.RECEBIDA };
      mockPrisma.ordemServico.findUnique.mockResolvedValue(os);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      await useCase.iniciarDiagnostico('os-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('deve rejeitar diagnóstico quando OS não está RECEBIDA', async () => {
      const os = { ...baseOS, status: StatusOS.EM_EXECUCAO };
      mockPrisma.ordemServico.findUnique.mockResolvedValue(os);

      await expect(useCase.iniciarDiagnostico('os-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('gerarOrcamento', () => {
    it('deve gerar orçamento calculando valores corretamente', async () => {
      const os = {
        ...baseOS,
        status: StatusOS.EM_DIAGNOSTICO,
        servicos: [
          { id: 's1', valor: 150, servicoId: 'svc-1' },
          { id: 's2', valor: 200, servicoId: 'svc-2' },
        ],
        pecas: [
          { id: 'p1', pecaId: 'peca-1', quantidade: 2, valorUnitario: 50 },
          { id: 'p2', pecaId: 'peca-2', quantidade: 1, valorUnitario: 100 },
        ],
      };
      mockPrisma.ordemServico.findUnique
        .mockResolvedValueOnce(os)
        .mockResolvedValue({ ...os, status: StatusOS.AGUARDANDO_APROVACAO });

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const txMock = {
          orcamento: { create: jest.fn() },
          ordemServico: { update: jest.fn() },
          historicoStatusOS: { create: jest.fn() },
        };
        await fn(txMock);
      });

      await useCase.gerarOrcamento('os-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('deve rejeitar gerar orçamento quando OS não está EM_DIAGNOSTICO', async () => {
      const os = { ...baseOS, status: StatusOS.RECEBIDA };
      mockPrisma.ordemServico.findUnique.mockResolvedValue(os);

      await expect(useCase.gerarOrcamento('os-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('aprovarOrcamento', () => {
    it('deve aprovar orçamento quando OS está AGUARDANDO_APROVACAO', async () => {
      const os = {
        ...baseOS,
        status: StatusOS.AGUARDANDO_APROVACAO,
        orcamentos: [{ id: 'orc-1', status: 'GERADO', valorTotal: 500 }],
        pecas: [],
      };
      mockPrisma.ordemServico.findUnique
        .mockResolvedValueOnce(os)
        .mockResolvedValue({ ...os, status: StatusOS.EM_EXECUCAO });

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const txMock = {
          orcamento: { update: jest.fn() },
          ordemServico: { update: jest.fn() },
          peca: { findUnique: jest.fn(), update: jest.fn() },
          historicoStatusOS: { create: jest.fn() },
        };
        await fn(txMock);
      });

      await useCase.aprovarOrcamento('os-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('deve rejeitar aprovação quando OS não está AGUARDANDO_APROVACAO', async () => {
      const os = { ...baseOS, status: StatusOS.RECEBIDA };
      mockPrisma.ordemServico.findUnique.mockResolvedValue(os);

      await expect(useCase.aprovarOrcamento('os-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('finalizar', () => {
    it('deve finalizar OS quando está EM_EXECUCAO', async () => {
      const os = {
        ...baseOS,
        status: StatusOS.EM_EXECUCAO,
        pecas: [{ pecaId: 'peca-1', quantidade: 2 }],
      };
      mockPrisma.ordemServico.findUnique
        .mockResolvedValueOnce(os)
        .mockResolvedValue({ ...os, status: StatusOS.FINALIZADA });

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
        const txMock = {
          peca: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'peca-1',
              quantidadeEstoque: 10,
              quantidadeReservada: 2,
            }),
            update: jest.fn(),
          },
          ordemServico: { update: jest.fn() },
          historicoStatusOS: { create: jest.fn() },
        };
        await fn(txMock);
      });

      await useCase.finalizar('os-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('deve rejeitar finalização quando OS não está EM_EXECUCAO', async () => {
      const os = { ...baseOS, status: StatusOS.RECEBIDA };
      mockPrisma.ordemServico.findUnique.mockResolvedValue(os);

      await expect(useCase.finalizar('os-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('entregar', () => {
    it('deve entregar veículo quando OS está FINALIZADA', async () => {
      const os = { ...baseOS, status: StatusOS.FINALIZADA };
      mockPrisma.ordemServico.findUnique
        .mockResolvedValueOnce(os)
        .mockResolvedValue({ ...os, status: StatusOS.ENTREGUE });
      mockPrisma.$transaction.mockResolvedValue(undefined);

      await useCase.entregar('os-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('deve rejeitar entrega quando OS não está FINALIZADA', async () => {
      const os = { ...baseOS, status: StatusOS.EM_EXECUCAO };
      mockPrisma.ordemServico.findUnique.mockResolvedValue(os);

      await expect(useCase.entregar('os-1')).rejects.toThrow(BusinessException);
    });
  });

  describe('consultarStatus', () => {
    it('deve retornar status da OS', async () => {
      mockPrisma.ordemServico.findUnique.mockResolvedValue({
        id: 'os-1',
        numero: 1,
        status: StatusOS.EM_DIAGNOSTICO,
      });

      const result = await useCase.consultarStatus('os-1');
      expect(result.status).toBe(StatusOS.EM_DIAGNOSTICO);
    });

    it('deve lançar exceção para OS inexistente', async () => {
      mockPrisma.ordemServico.findUnique.mockResolvedValue(null);

      await expect(useCase.consultarStatus('os-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
