package handler

import (
	"context"
	"math/rand/v2"
	"time"

	"connectrpc.com/connect"

	streamingv1 "github.com/maeshinshin/test/backend/gen/proto/streaming/v1"
	"github.com/maeshinshin/test/backend/gen/proto/streaming/v1/streamingv1connect"
)

const (
	streamDuration = 1 * time.Minute
	emitInterval   = 2 * time.Millisecond
	randomAlphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
)

var _ streamingv1connect.RandomStreamerHandler = (*RandomStreamerHandler)(nil)

// RandomStreamerHandler implements server-streaming RandomStreamer.
type RandomStreamerHandler struct {
	streamingv1connect.UnimplementedRandomStreamerHandler
}

// NewRandomStreamerHandler constructs a new handler.
func NewRandomStreamerHandler() *RandomStreamerHandler {
	return &RandomStreamerHandler{}
}

// StreamRandom emits a random character every emitInterval for up to
// streamDuration, then closes the stream. It respects ctx cancellation.
func (h *RandomStreamerHandler) StreamRandom(
	ctx context.Context,
	_ *streamingv1.StartRequest,
	stream *connect.ServerStream[streamingv1.RandomChar],
) error {
	deadline := time.Now().Add(streamDuration)
	ticker := time.NewTicker(emitInterval)
	defer ticker.Stop()

	var seq uint64 = 1
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case now := <-ticker.C:
			if now.After(deadline) {
				return nil
			}
			ch := randomAlphabet[rand.IntN(len(randomAlphabet))]
			if err := stream.Send(&streamingv1.RandomChar{
				Ch:        string(ch),
				Seq:       seq,
				EmittedAt: now.UTC().Format(time.RFC3339Nano),
			}); err != nil {
				return err
			}
			seq++
		}
	}
}
