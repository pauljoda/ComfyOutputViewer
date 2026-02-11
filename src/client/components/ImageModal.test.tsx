import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageItem, ModalTool } from '../types';
import ImageModal from './ImageModal';

const apiMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args)
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock('react-zoom-pan-pinch', async () => {
  const React = await import('react');
  const TransformWrapper = React.forwardRef(
    (
      {
        children,
        onInit
      }: {
        children: ReactNode;
        onInit?: () => void;
      },
      ref
    ) => {
      React.useImperativeHandle(ref, () => ({
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        zoomToElement: vi.fn(),
        resetTransform: vi.fn(),
        instance: {
          wrapperComponent: null,
          contentComponent: null
        },
        state: {
          scale: 1,
          positionX: 0,
          positionY: 0
        }
      }));
      React.useEffect(() => {
        onInit?.();
      }, [onInit]);
      return <div>{children}</div>;
    }
  );
  TransformWrapper.displayName = 'TransformWrapperMock';

  return {
    TransformWrapper,
    TransformComponent: ({ children }: { children: ReactNode }) => <div>{children}</div>
  };
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const buildImage = (id: string): ImageItem => ({
  id,
  name: id.split('/').pop() || id,
  url: `/images/${id}`,
  favorite: false,
  hidden: false,
  rating: 0,
  tags: [],
  createdMs: 0,
  mtimeMs: 0,
  size: 0
});

const buildPromptData = (imagePath: string) => ({
  imagePath,
  jobId: 1,
  workflowId: 12,
  promptData: {
    workflowId: 12,
    inputJson: {
      prompt: `prompt for ${imagePath}`
    }
  },
  createdAt: Date.now()
});

type RenderParams = {
  image: ImageItem;
  modalTool?: ModalTool;
};

const renderModal = ({ image, modalTool = null }: RenderParams) =>
  render(
    <ImageModal
      image={image}
      index={0}
      total={1}
      modalTool={modalTool}
      availableTags={[]}
      onUpdateTags={() => {}}
      onToggleTags={() => {}}
      onToggleRating={() => {}}
      onTogglePrompt={() => {}}
      onToggleFavorite={() => {}}
      onToggleHidden={() => {}}
      onRate={() => {}}
      onDelete={() => {}}
      onClose={() => {}}
      onPrev={() => {}}
      onNext={() => {}}
    />
  );

describe('ImageModal prompt loading', () => {
  beforeEach(() => {
    apiMock.mockReset();
    navigateMock.mockReset();
  });

  it('aborts stale prompt requests when switching images', async () => {
    const firstImage = buildImage('set-one/first.png');
    const secondImage = buildImage('set-two/second.png');
    const firstDeferred = createDeferred<ReturnType<typeof buildPromptData>>();
    const secondDeferred = createDeferred<ReturnType<typeof buildPromptData>>();
    let firstSignal: AbortSignal | undefined;
    let secondSignal: AbortSignal | undefined;

    apiMock.mockImplementation((path: string, options?: { signal?: AbortSignal }) => {
      if (path.includes(encodeURIComponent(firstImage.id))) {
        firstSignal = options?.signal;
        return firstDeferred.promise;
      }
      if (path.includes(encodeURIComponent(secondImage.id))) {
        secondSignal = options?.signal;
        return secondDeferred.promise;
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    const view = renderModal({ image: firstImage });

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <ImageModal
        image={secondImage}
        index={0}
        total={1}
        modalTool={null}
        availableTags={[]}
        onUpdateTags={() => {}}
        onToggleTags={() => {}}
        onToggleRating={() => {}}
        onTogglePrompt={() => {}}
        onToggleFavorite={() => {}}
        onToggleHidden={() => {}}
        onRate={() => {}}
        onDelete={() => {}}
        onClose={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledTimes(2);
      expect(firstSignal?.aborted).toBe(true);
      expect(secondSignal?.aborted).toBe(false);
    });

    secondDeferred.resolve(buildPromptData(secondImage.id));

    await waitFor(() => {
      expect(screen.getByLabelText('View prompt data')).toBeInTheDocument();
    });

    firstDeferred.resolve(buildPromptData(firstImage.id));

    await waitFor(() => {
      expect(screen.getByLabelText('View prompt data')).toBeInTheDocument();
    });
  });

  it('retries prompt loading when prompt panel is opened after a silent preload failure', async () => {
    const image = buildImage('set-one/retry.png');
    let callCount = 0;
    const capturedSignals: AbortSignal[] = [];

    apiMock.mockImplementation((path: string, options?: { signal?: AbortSignal }) => {
      if (!path.includes(encodeURIComponent(image.id))) {
        throw new Error(`Unexpected API path: ${path}`);
      }
      if (options?.signal) {
        capturedSignals.push(options.signal);
      }
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new Error('No prompt data found'));
      }
      return Promise.resolve(buildPromptData(image.id));
    });

    const view = renderModal({ image, modalTool: null });

    await waitFor(() => {
      expect(callCount).toBe(1);
      expect(screen.queryByText('No prompt data found')).not.toBeInTheDocument();
    });

    view.rerender(
      <ImageModal
        image={image}
        index={0}
        total={1}
        modalTool="prompt"
        availableTags={[]}
        onUpdateTags={() => {}}
        onToggleTags={() => {}}
        onToggleRating={() => {}}
        onTogglePrompt={() => {}}
        onToggleFavorite={() => {}}
        onToggleHidden={() => {}}
        onRate={() => {}}
        onDelete={() => {}}
        onClose={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );

    await waitFor(() => {
      expect(callCount).toBe(2);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Prompt metadata')).toBeInTheDocument();
      expect(screen.getByLabelText('View prompt data')).toBeInTheDocument();
    });

    expect(capturedSignals).toHaveLength(2);
    expect(capturedSignals[1].aborted).toBe(false);
  });
});
